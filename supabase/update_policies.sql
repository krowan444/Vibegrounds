-- VibeGrounds: RLS Update Policies
-- Run this in your Supabase SQL Editor AFTER all other .sql scripts

-- 1. Allow users to update their own creations (for edit post feature)
CREATE POLICY "Users can update own creations"
  ON public.creations FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 2. Allow users to update their own forum threads (for edit thread feature)
CREATE POLICY "Users can update own forum threads"
  ON public.forum_threads FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- 3. Allow users to update their own forum posts/replies (for edit reply feature)
CREATE POLICY "Users can update own forum posts"
  ON public.forum_posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);
