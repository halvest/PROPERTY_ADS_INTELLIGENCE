-- ==============================================================================
-- PROPERTY IMAGE ENHANCER MIGRATION
-- Professional AI Image Enhancement & Restoration for Real Estate Photos
-- ==============================================================================

-- 1. Create table for image enhancements
CREATE TABLE IF NOT EXISTS public.property_image_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_image_path TEXT NOT NULL,
  original_image_url TEXT NOT NULL,
  enhanced_image_path TEXT,
  enhanced_image_url TEXT,
  original_width INTEGER,
  original_height INTEGER,
  output_width INTEGER,
  output_height INTEGER,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  enhanced_file_size INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  enhancement_mode TEXT NOT NULL,
  preset TEXT NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 50,
  processing_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('queued', 'validating', 'analyzing', 'processing', 'completed', 'failed')),
  processing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scene_category TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 2. Indexes for fast organization-level query & pagination
CREATE INDEX IF NOT EXISTS idx_property_enhancements_org_created 
  ON public.property_image_enhancements(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_enhancements_user
  ON public.property_image_enhancements(user_id);

-- 3. Enable RLS
ALTER TABLE public.property_image_enhancements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for property_image_enhancements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_image_enhancements' AND policyname = 'Users can view their organization image enhancements') THEN
    CREATE POLICY "Users can view their organization image enhancements"
      ON public.property_image_enhancements FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_image_enhancements' AND policyname = 'Users can insert their organization image enhancements') THEN
    CREATE POLICY "Users can insert their organization image enhancements"
      ON public.property_image_enhancements FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_image_enhancements' AND policyname = 'Users can update their organization image enhancements') THEN
    CREATE POLICY "Users can update their organization image enhancements"
      ON public.property_image_enhancements FOR UPDATE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_image_enhancements' AND policyname = 'Users can delete their organization image enhancements') THEN
    CREATE POLICY "Users can delete their organization image enhancements"
      ON public.property_image_enhancements FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

