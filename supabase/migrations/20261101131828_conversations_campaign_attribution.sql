-- Store the campaign resolved from a selected or matched Meta ad.
-- Keep the campaign tenant-bound so a conversation cannot point across organizations.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- Single-column foreign key enabling PostgREST embedded joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_campaign_id_fkey'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_campaign_id_fkey
      FOREIGN KEY (campaign_id)
      REFERENCES public.campaigns (id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.conversations AS conversation
SET campaign_id = ad.campaign_id
FROM public.ads AS ad
WHERE conversation.ad_id = ad.id
  AND conversation.organization_id = ad.organization_id
  AND conversation.campaign_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id
  ON public.conversations (campaign_id)
  WHERE campaign_id IS NOT NULL;

