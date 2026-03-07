-- VibeGrounds: Creations Table
-- Run this in your Supabase SQL Editor AFTER running profiles.sql

-- 1. Create creations table
CREATE TABLE IF NOT EXISTS public.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thumbnail_url TEXT DEFAULT '',
  project_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;

-- 3. Public read access
CREATE POLICY "Creations are publicly readable"
  ON public.creations FOR SELECT
  USING (true);

-- 4. Authenticated users can insert own creations
CREATE POLICY "Users can insert own creations"
  ON public.creations FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- 5. Users can update own creations
CREATE POLICY "Users can update own creations"
  ON public.creations FOR UPDATE
  USING (auth.uid() = creator_id);

-- 6. Users can delete own creations
CREATE POLICY "Users can delete own creations"
  ON public.creations FOR DELETE
  USING (auth.uid() = creator_id);

-- 7. Index for category browsing
CREATE INDEX IF NOT EXISTS idx_creations_category ON public.creations(category);
CREATE INDEX IF NOT EXISTS idx_creations_creator ON public.creations(creator_id);
CREATE INDEX IF NOT EXISTS idx_creations_created_at ON public.creations(created_at DESC);
