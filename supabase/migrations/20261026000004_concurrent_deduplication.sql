-- Property Ads Intelligence - Concurrent Deduplication Hardening
-- Migration: 20261026000004_concurrent_deduplication.sql
-- Description: Enforces database-level idempotency against concurrent webhooks and retries

-- 1. Unique index for provider_message_id per organization (idempotent message delivery)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_id_unique
  ON public.messages (organization_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- 2. Unique index for phone_hash per organization (prevents duplicate contact creation under concurrency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone_hash_unique
  ON public.contacts (organization_id, phone_hash)
  WHERE phone_hash IS NOT NULL;
