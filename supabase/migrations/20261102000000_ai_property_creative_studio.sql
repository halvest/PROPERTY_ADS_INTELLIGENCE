-- ==============================================================================
-- AI PROPERTY AD CREATIVE STUDIO MIGRATION
-- HD Creative — Professional AI Property Advertising & Image Generation Studio
-- ==============================================================================

-- 1. Create table for creative projects
CREATE TABLE IF NOT EXISTS public.creative_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  campaign_name TEXT,
  headline TEXT,
  subheadline TEXT,
  description TEXT,
  property_type TEXT,
  property_location TEXT,
  starting_price NUMERIC,
  land_area NUMERIC,
  building_area NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  floors INTEGER,
  promo_headline TEXT,
  cashback_amount NUMERIC,
  has_free_ppn BOOLEAN DEFAULT false,
  dp_amount NUMERIC,
  monthly_installment NUMERIC,
  kpr_rate NUMERIC,
  promo_deadline DATE,
  cta_text TEXT DEFAULT 'Hubungi Kami',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create table for creative assets (photos & logos)
CREATE TABLE IF NOT EXISTS public.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('facade', 'interior', 'living_room', 'bedroom', 'environment', 'facility', 'logo', 'other')),
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create table for creative generations (ad outputs)
CREATE TABLE IF NOT EXISTS public.creative_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('1:1', '4:5', '9:16')),
  style_preset TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  raw_image_url TEXT,
  final_composed_url TEXT NOT NULL,
  creative_direction JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_used TEXT,
  quality_score JSONB NOT NULL DEFAULT '{"visual": 92, "readability": 95, "conversion": 90}'::jsonb,
  revision_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('generating', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create table for creative variations
CREATE TABLE IF NOT EXISTS public.creative_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES public.creative_generations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  variation_label TEXT NOT NULL,
  style_preset TEXT NOT NULL,
  final_composed_url TEXT NOT NULL,
  headline TEXT,
  accent_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_creative_projects_org ON public.creative_projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_assets_project ON public.creative_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_creative_generations_project ON public.creative_generations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_generations_org ON public.creative_generations(organization_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.creative_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_variations ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_assets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_generations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_variations TO authenticated, service_role;

-- RLS Policies for creative_projects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_projects' AND policyname = 'Users can view their organization creative projects') THEN
    CREATE POLICY "Users can view their organization creative projects"
      ON public.creative_projects FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_projects' AND policyname = 'Users can insert their organization creative projects') THEN
    CREATE POLICY "Users can insert their organization creative projects"
      ON public.creative_projects FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_projects' AND policyname = 'Users can update their organization creative projects') THEN
    CREATE POLICY "Users can update their organization creative projects"
      ON public.creative_projects FOR UPDATE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_projects' AND policyname = 'Users can delete their organization creative projects') THEN
    CREATE POLICY "Users can delete their organization creative projects"
      ON public.creative_projects FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- RLS Policies for creative_assets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_assets' AND policyname = 'Users can view their organization creative assets') THEN
    CREATE POLICY "Users can view their organization creative assets"
      ON public.creative_assets FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_assets' AND policyname = 'Users can insert their organization creative assets') THEN
    CREATE POLICY "Users can insert their organization creative assets"
      ON public.creative_assets FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_assets' AND policyname = 'Users can delete their organization creative assets') THEN
    CREATE POLICY "Users can delete their organization creative assets"
      ON public.creative_assets FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- RLS Policies for creative_generations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_generations' AND policyname = 'Users can view their organization creative generations') THEN
    CREATE POLICY "Users can view their organization creative generations"
      ON public.creative_generations FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_generations' AND policyname = 'Users can insert their organization creative generations') THEN
    CREATE POLICY "Users can insert their organization creative generations"
      ON public.creative_generations FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_generations' AND policyname = 'Users can update their organization creative generations') THEN
    CREATE POLICY "Users can update their organization creative generations"
      ON public.creative_generations FOR UPDATE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_generations' AND policyname = 'Users can delete their organization creative generations') THEN
    CREATE POLICY "Users can delete their organization creative generations"
      ON public.creative_generations FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- RLS Policies for creative_variations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_variations' AND policyname = 'Users can view their organization creative variations') THEN
    CREATE POLICY "Users can view their organization creative variations"
      ON public.creative_variations FOR SELECT
      USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'creative_variations' AND policyname = 'Users can insert their organization creative variations') THEN
    CREATE POLICY "Users can insert their organization creative variations"
      ON public.creative_variations FOR INSERT
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Insert property-creatives bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-creatives',
  'property-creatives',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for property-creatives
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for property-creatives') THEN
    CREATE POLICY "Public Access for property-creatives"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'property-creatives');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload to property-creatives') THEN
    CREATE POLICY "Authenticated users can upload to property-creatives"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'property-creatives' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete from property-creatives') THEN
    CREATE POLICY "Authenticated users can delete from property-creatives"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'property-creatives' AND auth.role() = 'authenticated');
  END IF;
END $$;

