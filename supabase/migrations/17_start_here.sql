-- ============================================================
-- VIBEGROUNDS — 17: START HERE (learn to vibe code)
-- ============================================================
-- A beginner section in the forum. Six pinned guides that take someone
-- from "I have never written code" to "I have posted a thing".
--
-- Pinned but NOT locked, deliberately. A locked guide is a manual; the
-- point of putting this in the forum rather than on a static page is that
-- a beginner can ask their question directly under the lesson that
-- confused them. Somebody asking "what is GitHub" beneath the deploy
-- guide is the feature working, not noise.
--
-- Authored by the admin account because forum_threads.author_id is a real
-- foreign key to profiles — there is no system user, and inventing one
-- would put a fake member on the leaderboards.
-- ============================================================

insert into public.forum_categories (slug, name, description, icon, sort_order) values
  ('start-here', 'Start Here',
   'New to vibe coding? Begin here. No question is too basic.', '🌱', -1)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

do $mig$
declare
  v_cat   uuid;
  v_admin uuid;
begin
  select id into v_cat   from public.forum_categories where slug = 'start-here';
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;

  if v_admin is null then
    raise notice 'No admin profile found - skipping guide seed.';
    return;
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$Start here: what vibe coding actually is (and why you can do it)$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$Start here: what vibe coding actually is (and why you can do it)$t$, $g$Welcome. Genuinely.

If you have never written a line of code and you are wondering whether this place is for you — it is. That is what this whole section is for.

**So what is vibe coding?**

You describe what you want in plain English. An AI writes the code. You look at what comes back, tell it what is wrong, and go again. That loop — describe, look, correct — is the whole thing.

The name came from a throwaway line by Andrej Karpathy about "giving in to the vibes" and forgetting the code even exists. It stuck, partly because it is funny and partly because it is roughly accurate.

Worth knowing: not everyone loves the term. Peter Steinberger, who built OpenClaw, has said flatly that "vibe coding is a slur" — his point being that steering an AI well is a real skill you get better at, not a shrug. He is not wrong. We use the name here because it is what people search for, not because we think it is effortless.

**What you actually need**

- A computer and an internet connection.
- An idea small enough to describe in two sentences.
- Enough patience to go round the loop a few times.

That is the list. No degree, no bootcamp, no maths.

**What nobody tells beginners**

*It will not work first time.* Not for you, not for anyone. The people posting slick demos have edited out forty minutes of arguing with a machine. When your first attempt comes back broken, that is not you failing — that is the normal middle part.

*You will not understand all the code, and that is survivable.* You do need to understand what your thing does and roughly how the pieces connect. You do not need to be able to write it from scratch. Steinberger literally says "I ship code I don't read."

*Small and finished beats big and abandoned.* A working to-do list you actually use is worth more than an ambitious app that never ran.

**What this section covers**

1. This post — what it is, what you need
2. Picking a tool — an honest look at what is out there
3. Your first project — something tiny that works
4. Talking to the AI — prompting that actually gets results
5. Getting unstuck — when it loops and you want to throw the laptop
6. Getting it online — so other people can use the thing

Work through them in order if you like, or skip about.

**Ask things**

Replies are open on every one of these. There is no question too basic. If you are stuck on something that feels stupid, post it — you will not be the only one, you will just be the one who said it out loud.

Then come and post what you make. Even if it is rubbish. Especially if it is rubbish.$g$, true);
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$Pick your tool: an honest guide to what is out there$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$Pick your tool: an honest guide to what is out there$t$, $g$There are a lot of these and the list changes every few months. Here is the honest version.

**The single most useful question: can you code a bit, or not at all?**

That is what actually decides this. Not price, not hype.

**If you have never coded — start in the browser**

These take plain English and give you a working app. No install, no terminal, nothing to set up.

- **Lovable** — describe an app, get a working one. Probably the friendliest starting point in 2026.
- **Bolt** — same idea, very fast at getting something on screen.
- **v0 by Vercel** — strongest when you want something that *looks* good. Very good at interfaces.

Pick one. Do not spend a week comparing them — they are more alike than different, and the one you actually open is the best one.

**If you can code a little — go to the editor or terminal**

- **Cursor** — a code editor with AI built in. The natural step up if you have seen code before.
- **Claude Code** — runs in your terminal, works across a whole project at once. Powerful, less hand-holding.
- **Windsurf**, **Antigravity** and others sit in similar territory.

The rough consensus in 2026: Claude Code if you can code, Lovable if you cannot. Plenty of people run Claude Code for the guts and Cursor for the visual bits.

**What about the chatbot I already use?**

ChatGPT or Claude in a browser tab will happily write you code you then copy and paste. It works. It is slower and more fiddly than a proper tool, but if you already pay for one, it is a free way to find out whether you enjoy this at all.

**On money**

Most have a free tier that is enough to find out if you like it. Do not pay for anything until you have hit the limit of a free one — that is the only way to know what you actually need.

**One warning about this whole post**

This list will go out of date. It moves fast — tools launch, get bought, get renamed, get abandoned. If you are reading this months later, take it as a starting point and check what people are actually using now. Ask in the replies; someone will know.

**The actual advice**

Open one. Today. Build the smallest thing you can think of. You will learn more in that hour than in a week of reading comparisons — including this one.$g$, true);
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$Your first project: build something tiny that works$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$Your first project: build something tiny that works$t$, $g$The biggest mistake beginners make is starting too big. Here is the fix.

**Build something that does one thing**

Not a social network. Not "Uber but for X". One thing.

Good first projects:
- A countdown to a date you care about
- A page that picks what you should eat tonight
- A tip calculator
- A tracker for one habit
- A soundboard of noises that make you laugh
- A page that tells you if your team won

Bad first projects: anything with accounts, payments, messaging, or the word "platform".

**Why small wins**

A small thing finishes. A finished thing gets posted, gets rated, gets a comment — and that is the bit that makes you want to build the next one. A big thing sits half-built until you quietly stop opening it.

You are not learning "how to build an app". You are learning the loop: describe, look, correct. You can learn that on a tip calculator.

**How the first hour goes**

1. Open your tool.
2. Type what you want in a couple of plain sentences. Not technical — just what it does.
3. Wait. Look at what comes back.
4. Something will be wrong. Say what, specifically.
5. Repeat until it works.
6. Stop. You are done. Do not add features.

**A real example**

Instead of: "build me a fitness app"

Try: "A single web page with one button that says I did my run today. When I click it, it saves today's date and shows a list of every date I have clicked. Dark background, big friendly button."

That second one gets you something that works. The first one gets you a mess.

**When you have it**

Post it. Yes, honestly. A tip calculator is a completely legitimate submission — you built a thing that works and that is the entire bar.

If you would rather warm up first, post a meme. It is free, it takes ten seconds, and it gets you off zero.

**Then do it again**

Second project, slightly bigger. Third, bigger again. That is how everyone who is any good at this got there. Nobody's first build was impressive. Ours certainly were not.$g$, true);
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$How to actually talk to the AI (prompting that works)$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$How to actually talk to the AI (prompting that works)$t$, $g$This is the actual skill. Everything else is tooling.

**Say what it does, not how to build it**

The AI knows how to build things. It does not know what you want. Spend your words on the second one.

Weak: "make a good website for my band"
Strong: "A one-page site for a punk band. Big band name at the top, list of five upcoming gigs with dates and venues, a link to Spotify, black background, loud red text."

**One change at a time**

The single most useful habit. When you ask for six changes at once, you get four of them and two new bugs, and no idea which instruction caused what.

Ask for one thing. Check it. Ask for the next.

**Describe the problem, not your guess at the cause**

Weak: "the CSS is broken"
Strong: "The button is behind the image and I cannot click it."

You are not expected to diagnose. Say what you see. That is more useful than a wrong theory, which sends it hunting in the wrong place.

**Be specific about the bits you care about**

"Make it look better" gets you someone else's taste. If you want a particular thing, say it: colours, size, position, what happens on click.

**Tell it when something is right**

"That is exactly right, keep that and now add X" is a genuinely useful instruction. It stops the next round quietly undoing the thing you liked.

**Do not be polite at the expense of being clear**

"Maybe it might be nice if perhaps the button was a bit bigger?" is worse than "make the button bigger". You are not being rude. Be direct.

**Ask it to explain**

"What does this file do?" or "explain that in plain English" costs nothing and is how you slowly stop being a beginner. Do this even when things are working.

**When you cannot describe it, show it**

Most tools take screenshots now. A picture of what is wrong, or of a design you like, beats three paragraphs.

**The mindset that helps**

Treat it like briefing a fast, capable, slightly literal-minded freelancer who cannot see your screen and has no idea what is in your head. Everything they need, they need from you.

That framing gets you further than any list of magic words.$g$, true);
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$When it goes in circles: eight ways to get unstuck$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$When it goes in circles: eight ways to get unstuck$t$, $g$Everyone hits this. The AI fixes the bug, which breaks something else, which it fixes, which brings the first bug back. Round and round.

It is not you. It happens to people who do this for a living. Here is how to get out.

**1. Stop asking the same way**

If you have asked twice and got the same broken answer, asking a third time will not work. Change something: describe the problem differently, say what you already tried, or ask it to explain what it thinks the code is doing.

**2. Go back instead of forward**

The strongest move, and the one beginners resist most. If it worked twenty minutes ago and does not now, throw away the last twenty minutes and start that bit again.

Most tools have undo or version history. Learn where yours is *before* you need it.

**3. Ask it to explain rather than fix**

"Do not change anything. Explain why the button does not work."

Forcing it to reason out loud often surfaces the thing it kept skipping past. And you learn something.

**4. Cut the problem in half**

If a page with six features is broken, ask for a page with one. Then add the second. Whichever addition breaks it is your culprit.

**5. Start a fresh conversation**

Long chats drift. Everything wrong earlier is still sitting in its memory, colouring what it does next. Open a new chat, describe the current state cleanly, ask again. Fixes a surprising amount.

**6. Try a different model or tool**

They fail in different ways. A wall in one is often nothing in another.

**7. Put it down**

Not a joke. Go away for an hour. A very high number of "impossible" bugs turn out to be obvious after a walk, because you stop defending the approach you have been sunk into.

**8. Ask here**

Post in the replies with: what you are building, what you want to happen, what happens instead, and what you have tried. Someone will have hit it.

**The thing to internalise**

Getting stuck is not evidence you cannot do this. It is the job. The difference between people who ship and people who quit is not talent — it is that the ones who ship expected this bit and had a couple of moves ready.

You now have eight.$g$, true);
  end if;

  if not exists (select 1 from public.forum_threads where category_id = v_cat and title = $t$Getting it online so other people can use it$t$) then
    insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
    values (v_cat, v_admin, $t$Getting it online so other people can use it$t$, $g$A thing on your laptop is a nice afternoon. A thing with a link is something you can show your mates, post here, and put in the charts.

**The good news**

If you built it in Lovable, Bolt or v0, you may already be done — they host it for you. Look for Publish or Deploy. You get a link. That is it, you can stop reading.

**If you have files on your computer**

The usual free routes:

- **Vercel** — connect a GitHub repo, get a link. The default for most people.
- **Netlify** — much the same, equally fine.
- **GitHub Pages** — free, good for simple pages.
- **Cloudflare Pages** — free, very fast.

All have generous free tiers. You do not need to pay to put a small project online.

**"I don't know what GitHub is"**

Reasonable. It is where code lives so hosts can find it. Ask your AI: "walk me through putting this project on GitHub, I have never used it." It will hold your hand through it. This is a completely standard thing to not know.

**Before you share it**

- Open your link on your phone. Half of everything is broken on a phone.
- Send it to one person and watch them use it without helping. Deeply humbling, extremely useful.
- Check you have not put any passwords or API keys in the code. If your AI put a key straight in a file, ask it to move it somewhere safe before you publish.

That last one matters. Keys in public code get found by bots within hours.

**Then post it here**

Portal → Submit. Costs 10 coins; you got 50 free for signing up. Add the link, a couple of honest lines about what it does, and let strangers score it out of 5.

The scores can sting. They are also the only real signal you will get about whether the thing is any good, and they are why this site exists.

**Then the important bit**

Go and rate five other people's things. It pays coins, it takes two minutes, and a scoring site where nobody scores anything is just a list.

You have gone from never having built anything to having a thing online that strangers can use and judge. That is not a small thing. Go and do it again.$g$, true);
  end if;

end $mig$;
