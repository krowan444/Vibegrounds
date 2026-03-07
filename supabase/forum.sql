-- VibeGrounds: Forum Tables
-- Run this in your Supabase SQL Editor

-- 1. Forum Categories (seeded with starter boards)
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum categories are publicly readable"
  ON public.forum_categories FOR SELECT USING (true);

-- Seed starter categories
INSERT INTO public.forum_categories (name, description, slug, sort_order) VALUES
  ('General Discussion', 'Talk about anything and everything.', 'general', 1),
  ('Vibe Coding', 'Share tips, tricks, and code experiments.', 'vibe-coding', 2),
  ('Show Your Project', 'Share what you built and get feedback.', 'show-project', 3),
  ('Help & Feedback', 'Ask questions and help fellow vibers.', 'help-feedback', 4),
  ('Retro Internet', 'Nostalgia, old-school web, and early internet culture.', 'retro-internet', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. Forum Threads
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  body TEXT NOT NULL CHECK (char_length(body) <= 5000),
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  reply_count INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum threads are publicly readable"
  ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create threads"
  ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 3. Forum Posts (replies)
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 5000),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum posts are publicly readable"
  ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_threads_category ON public.forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_activity ON public.forum_threads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_author ON public.forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON public.forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.forum_posts(created_at ASC);

-- 5. Function to update thread reply count + last activity on new post
CREATE OR REPLACE FUNCTION public.handle_new_forum_post()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.forum_threads
  SET reply_count = reply_count + 1,
      last_activity_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_forum_post_created ON public.forum_posts;
CREATE TRIGGER on_forum_post_created
  AFTER INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_forum_post();
