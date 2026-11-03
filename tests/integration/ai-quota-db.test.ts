/**
 * DB-level integration tests for the AI usage quota RPCs.
 *
 * These tests exercise the REAL SQL behavior (rolling window, concurrency,
 * expiry, per-user isolation) against a DEDICATED TEST Supabase project.
 * They are SKIPPED unless all of the following are set explicitly:
 *
 *   AI_QUOTA_TEST_CONFIRM=DEDICATED_TEST_PROJECT
 *   AI_QUOTA_TEST_SUPABASE_URL=<test project url>
 *   AI_QUOTA_TEST_SERVICE_ROLE_KEY=<test project service role key>
 *   AI_QUOTA_TEST_USER_A=<uuid of a test auth user>
 *   AI_QUOTA_TEST_USER_B=<uuid of another test auth user>
 *
 * Never point these at the production project: the tests delete quota rows
 * for the two test users before and after each run.
 *
 * Status when skipped: NOT VERIFIED at DB level (unit/mock tests only).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

const enabled =
  process.env.AI_QUOTA_TEST_CONFIRM === "DEDICATED_TEST_PROJECT" &&
  Boolean(process.env.AI_QUOTA_TEST_SUPABASE_URL) &&
  Boolean(process.env.AI_QUOTA_TEST_SERVICE_ROLE_KEY) &&
  Boolean(process.env.AI_QUOTA_TEST_USER_A) &&
  Boolean(process.env.AI_QUOTA_TEST_USER_B);

const userA = process.env.AI_QUOTA_TEST_USER_A as string;
const userB = process.env.AI_QUOTA_TEST_USER_B as string;

describe.skipIf(!enabled)("AI quota RPCs (dedicated test project)", () => {
  let db: SupabaseClient;

  async function cleanup() {
    await db.from("ai_analysis_usage").delete().in("user_id", [userA, userB]);
  }

  beforeAll(async () => {
    db = createClient(
      process.env.AI_QUOTA_TEST_SUPABASE_URL as string,
      process.env.AI_QUOTA_TEST_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    );
    await cleanup();
  });

  async function reserve(userId: string, key: string = randomUUID()) {
    const { data, error } = await db.rpc("reserve_ai_analysis_usage", {
      p_user_id: userId,
      p_idempotency_key: key,
    });
    expect(error).toBeNull();
    return data?.[0];
  }

  async function complete(userId: string, reservationId: string, succeeded: boolean) {
    const { data, error } = await db.rpc("complete_ai_analysis_usage", {
      p_user_id: userId,
      p_reservation_id: reservationId,
      p_succeeded: succeeded,
      p_failure_code: succeeded ? null : "test_failure",
    });
    expect(error).toBeNull();
    return data;
  }

  async function usage(userId: string) {
    const { data, error } = await db.rpc("get_ai_analysis_usage", { p_user_id: userId });
    expect(error).toBeNull();
    return data?.[0];
  }

  it("starts at 3 and rejects the fourth successful analysis", async () => {
    await cleanup();
    expect(await usage(userA)).toMatchObject({ used_count: 0, remaining_count: 3 });
    for (let i = 0; i < 3; i++) {
      const r = await reserve(userA);
      expect(r.allowed).toBe(true);
      expect(await complete(userA, r.reservation_id, true)).toBe(true);
    }
    expect(await usage(userA)).toMatchObject({ used_count: 3, remaining_count: 0 });
    const fourth = await reserve(userA);
    expect(fourth.allowed).toBe(false);
    expect(fourth.reservation_status).toBe("limit_reached");
  });

  it("does not consume quota for failed analyses", async () => {
    await cleanup();
    const r = await reserve(userA);
    expect(await complete(userA, r.reservation_id, false)).toBe(true);
    expect(await usage(userA)).toMatchObject({ used_count: 0, remaining_count: 3 });
  });

  it("does not consume twice for the same idempotency key", async () => {
    await cleanup();
    const key = randomUUID();
    const first = await reserve(userA, key);
    expect(first.allowed).toBe(true);
    const duplicate = await reserve(userA, key);
    expect(duplicate.allowed).toBe(false);
    expect(duplicate.reservation_status).toBe("in_progress");
    expect(await complete(userA, first.reservation_id, true)).toBe(true);
    const afterSuccess = await reserve(userA, key);
    expect(afterSuccess.allowed).toBe(false);
    expect(afterSuccess.reservation_status).toBe("already_completed");
    expect(await usage(userA)).toMatchObject({ used_count: 1 });
  });

  it("cannot be bypassed by concurrent requests", async () => {
    await cleanup();
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => reserve(userA))
    );
    expect(attempts.filter((a) => a.allowed)).toHaveLength(3);
  });

  it("cannot complete an expired reservation", async () => {
    await cleanup();
    const r = await reserve(userA);
    expect(r.allowed).toBe(true);
    await db
      .from("ai_analysis_usage")
      .update({ reserved_until: new Date(Date.now() - 1000).toISOString() })
      .eq("id", r.reservation_id);
    expect(await complete(userA, r.reservation_id, true)).toBe(false);
    expect(await usage(userA)).toMatchObject({ used_count: 0 });
  });

  it("isolates quota per user", async () => {
    await cleanup();
    const r = await reserve(userA);
    expect(await complete(userA, r.reservation_id, true)).toBe(true);
    expect(await usage(userA)).toMatchObject({ used_count: 1 });
    expect(await usage(userB)).toMatchObject({ used_count: 0, remaining_count: 3 });
    // User B cannot complete (consume/release) User A's reservation.
    const rb = await reserve(userB);
    expect(await complete(userA, rb.reservation_id, true)).toBe(false);
  });
});
