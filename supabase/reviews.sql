-- VibeGrounds: Reviews & Reactions Tables
-- Run this in your Supabase SQL Editor AFTER profiles.sql and creations.sql

-- 1. Reactions table (quick emoji reactions per project)
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('fire', 'like', 'clever', 'funny')),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creation_id, session_id, reaction_type)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are publicly readable"
  ON public.reactions FOR SELECT USING (true);

CREATE POLICY "Anyone can insert reactions"
  ON public.reactions FOR INSERT WITH CHECK (true);

-- 2. Reviews table (text comments on projects)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_avatar TEXT DEFAULT '',
  comment TEXT NOT NULL CHECK (char_length(comment) <= 500),
  reported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are publicly readable"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Reviews can be updated for reporting"
  ON public.reviews FOR UPDATE USING (true);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_creation ON public.reactions(creation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_creation ON public.reviews(creation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
