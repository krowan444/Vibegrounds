-- ============================================================
-- VIBEGROUNDS — 18: HALL OF FAME, OPENCLAW
-- ============================================================
-- The most-starred thing anyone has built this way, and the story
-- behind the name is half the reason it belongs here.
--
-- Deliberately NOT described as vibe coding. Steinberger has said
-- flatly that he considers the term a slur — using it on his own
-- entry would be putting a label on someone who has publicly
-- rejected it, in a section whose entire point is crediting people
-- on their own terms. The blurb credits the work and lets his
-- writing speak for the method.
--
-- built_with is left null on purpose. Every other field here is
-- sourced; guessing at his exact toolchain to fill a column would
-- be the one unsourced claim on the page.
-- ============================================================

insert into public.hall_of_fame
  (rank, title, creator, creator_url, project_url, blurb, category, built_with, source_url, source_label, is_active)
select 4,
  'OpenClaw',
  'Peter Steinberger',
  'https://steipete.me/about',
  'https://github.com/openclaw/openclaw',
  $b$Started life as a personal assistant called CLAWDIS, became Clawdbot, then Moltbot after Anthropic objected to the Claude-adjacent name, and finally OpenClaw — because Moltbot "never quite rolled off the tongue". An open-source agent that runs locally and takes its orders through Signal, Telegram or WhatsApp. It hit roughly 247,000 GitHub stars by March 2026; Steinberger joined OpenAI that February and handed stewardship to a foundation. Worth reading his writing on shipping code you have not read.$b$,
  'software',
  null,
  'https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html',
  'CNBC',
  true
where not exists (select 1 from public.hall_of_fame where title = 'OpenClaw');
