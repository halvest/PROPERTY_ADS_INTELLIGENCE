-- Free tier: no more than three successful AI analyses in a rolling 7-day window.
-- Rows are user-owned. The application accesses them only through server-side RPCs.
create table if not exists public.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  status text not null check (status in ('reserved', 'succeeded', 'failed')),
  reserved_at timestamptz not null default now(),
  reserved_until timestamptz,
  completed_at timestamptz,
  failure_code text,
  constraint ai_analysis_usage_user_key_unique unique (user_id, idempotency_key),
  constraint ai_analysis_usage_completion_check check (
    (status = 'succeeded' and completed_at is not null) or status <> 'succeeded'
  )
);

create index if not exists ai_analysis_usage_user_success_idx
  on public.ai_analysis_usage (user_id, completed_at desc)
  where status = 'succeeded';
create index if not exists ai_analysis_usage_active_reservation_idx
  on public.ai_analysis_usage (user_id, reserved_until)
  where status = 'reserved';

create table if not exists public.ai_analysis_quota_locks (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.ai_analysis_usage enable row level security;
alter table public.ai_analysis_quota_locks enable row level security;
revoke all on public.ai_analysis_usage, public.ai_analysis_quota_locks from public, anon, authenticated;
grant select, insert, update, delete on public.ai_analysis_usage, public.ai_analysis_quota_locks to service_role;

create or replace function public.reserve_ai_analysis_usage(p_user_id uuid, p_idempotency_key uuid)
returns table (allowed boolean, reservation_status text, reservation_id uuid, used_count integer, reserved_count integer, remaining_count integer, next_available_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.ai_analysis_usage%rowtype;
  v_used integer;
  v_reserved integer;
  v_next timestamptz;
begin
  insert into public.ai_analysis_quota_locks(user_id) values (p_user_id) on conflict do nothing;
  perform 1 from public.ai_analysis_quota_locks where user_id = p_user_id for update;

  select * into v_existing from public.ai_analysis_usage
    where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if found and v_existing.status = 'succeeded' then
    select count(*)::integer into v_used from public.ai_analysis_usage
      where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';
    select count(*)::integer into v_reserved from public.ai_analysis_usage
      where user_id = p_user_id and status = 'reserved' and reserved_until > now();
    select min(completed_at + interval '7 days') into v_next from public.ai_analysis_usage
      where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';
    return query select false, 'already_completed', v_existing.id, v_used, v_reserved, greatest(0, 3 - v_used - v_reserved), v_next;
    return;
  end if;
  if found and v_existing.status = 'reserved' and v_existing.reserved_until > now() then
    select count(*)::integer into v_used from public.ai_analysis_usage
      where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';
    select count(*)::integer into v_reserved from public.ai_analysis_usage
      where user_id = p_user_id and status = 'reserved' and reserved_until > now();
    select min(completed_at + interval '7 days') into v_next from public.ai_analysis_usage
      where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';
    return query select false, 'in_progress', v_existing.id, v_used, v_reserved, greatest(0, 3 - v_used - v_reserved), coalesce(v_next, v_existing.reserved_until);
    return;
  end if;

  select count(*)::integer into v_used from public.ai_analysis_usage
    where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';
  select count(*)::integer into v_reserved from public.ai_analysis_usage
    where user_id = p_user_id and status = 'reserved' and reserved_until > now();
  select min(completed_at + interval '7 days') into v_next from public.ai_analysis_usage
    where user_id = p_user_id and status = 'succeeded' and completed_at > now() - interval '7 days';

  if v_used + v_reserved >= 3 then
    return query select false, 'limit_reached', null::uuid, v_used, v_reserved, 0,
      least(v_next, (select min(reserved_until) from public.ai_analysis_usage where user_id = p_user_id and status = 'reserved' and reserved_until > now()));
    return;
  end if;

  if v_existing.id is not null then
    update public.ai_analysis_usage set status = 'reserved', reserved_at = now(), reserved_until = now() + interval '5 minutes', completed_at = null, failure_code = null
      where id = v_existing.id returning * into v_existing;
  else
    insert into public.ai_analysis_usage(user_id, idempotency_key, status, reserved_until)
      values (p_user_id, p_idempotency_key, 'reserved', now() + interval '5 minutes') returning * into v_existing;
  end if;
  return query select true, 'reserved', v_existing.id, v_used, v_reserved + 1, greatest(0, 3 - v_used - v_reserved - 1), coalesce(v_next, v_existing.reserved_until);
end;
$$;

create or replace function public.complete_ai_analysis_usage(p_user_id uuid, p_reservation_id uuid, p_succeeded boolean, p_failure_code text default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  insert into public.ai_analysis_quota_locks(user_id) values (p_user_id) on conflict do nothing;
  perform 1 from public.ai_analysis_quota_locks where user_id = p_user_id for update;
  -- A reservation is only completable while still reserved AND unexpired.
  -- An expired reservation (reserved_until <= now()) can no longer be
  -- completed as a success: the caller must retry, and the reserve path
  -- will re-activate the same (user_id, idempotency_key) row. The 5-minute
  -- TTL is far above the longest AI provider timeout in the app (35s), so
  -- an active request never loses its reservation prematurely.
  update public.ai_analysis_usage
    set status = case when p_succeeded then 'succeeded' else 'failed' end,
        completed_at = case when p_succeeded then now() else null end,
        reserved_until = null,
        failure_code = case when p_succeeded then null else left(coalesce(p_failure_code, 'analysis_failed'), 80) end
    where id = p_reservation_id and user_id = p_user_id and status = 'reserved'
      and reserved_until > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.get_ai_analysis_usage(p_user_id uuid)
returns table (used_count integer, reserved_count integer, remaining_count integer, next_available_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  with usage as (
    select
      count(*) filter (where status = 'succeeded' and completed_at > now() - interval '7 days')::integer as used_count,
      count(*) filter (where status = 'reserved' and reserved_until > now())::integer as reserved_count,
      min(completed_at + interval '7 days') filter (where status = 'succeeded' and completed_at > now() - interval '7 days') as success_reset,
      min(reserved_until) filter (where status = 'reserved' and reserved_until > now()) as reservation_reset
    from public.ai_analysis_usage
    where user_id = p_user_id
  )
  select used_count, reserved_count, greatest(0, 3 - used_count - reserved_count), least(success_reset, reservation_reset)
  from usage;
$$;

revoke all on function public.reserve_ai_analysis_usage(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_ai_analysis_usage(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.get_ai_analysis_usage(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis_usage(uuid, uuid) to service_role;
grant execute on function public.complete_ai_analysis_usage(uuid, uuid, boolean, text) to service_role;
grant execute on function public.get_ai_analysis_usage(uuid) to service_role;

-- Make the new RPC signatures visible to PostgREST immediately after migration.
notify pgrst, 'reload schema';
