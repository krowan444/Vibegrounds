-- ============================================================
-- 42 — THE OG BADGE CLOSES IN OCTOBER, NOT JANUARY
-- ============================================================
-- Kieran wants OG Member to be properly rare. It was not: the
-- cutoff sat at 2027-01-01, so anybody joining in the next four
-- months got it. A badge four months of signups can still earn is
-- not a founding badge, it is a welcome gift.
--
-- New cutoff: 2026-10-01. Roughly three weeks from writing, which
-- is short enough to mean something and long enough to be worth
-- announcing — "last few weeks for the OG badge" is a reason to
-- join this month rather than eventually.
--
-- HOW THE TWO CONTROLS DIFFER, because they are easy to confuse
-- and only one of them belongs in this change:
--
--   og_badge_cutoff (setting) tests the MEMBER'S signup date:
--     evaluate_badges grants og-member when
--     profiles.created_at < cutoff. Changing it changes who
--     qualifies. This is the one being moved.
--
--   badges.retires_at tests NOW: grant_badge refuses outright once
--     now() >= retires_at, for everybody, permanently. It stays at
--     2027-01-01 deliberately. Bringing it forward to October too
--     would look tidier and would quietly break a real case — a
--     member who signs up on 28 September but does not confirm
--     their email until 3 October qualifies on the date that
--     matters, and grant_badge would refuse them because the
--     badge itself had retired in the meantime. Leaving it in
--     January costs nothing: after 1 October no evaluation asks
--     for the badge anyway, because nobody's created_at passes
--     the cutoff.
--
-- NOBODY LOSES IT. evaluate_badges only ever grants; there is no
-- path that revokes. Everyone holding OG today keeps it.
--
-- REVERSIBLE until 2027-01-01. Push the setting back out and
-- qualifying accounts pick it up on their next evaluation.
-- ============================================================

-- Written directly rather than through admin_set_setting().
--
-- That function is the right door from the Control Room and the
-- wrong one from here: it starts with `if not public.is_admin()`,
-- and a migration run in the SQL editor carries no JWT, so
-- auth.uid() is null and it raises "Admins only." (Confirmed
-- against the schema before writing this, rather than found out on
-- production.)
--
-- The other thing that function does is log to moderation_actions
-- with actor_id = auth.uid(). There is no actor here — this is a
-- migration, not somebody clicking a button — so an entry
-- attributing it to nobody would be worse than no entry. The
-- migration file is the record.
insert into public.site_settings (key, value, description) values
  ('og_badge_cutoff',
   '"2026-10-01T00:00:00Z"'::jsonb,
   'Accounts created before this date get the OG badge')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();


-- ------------------------------------------------------------
-- Say the right date on the badge itself
--
-- The description and the criteria blob both still read
-- "January 2027". The Trophy Cabinet renders the description
-- straight onto the page, so leaving it would have the site
-- promising a deadline it no longer honours — the one kind of
-- wrong text that costs trust rather than just looking untidy.
--
-- retires_at is deliberately NOT touched here. See above.
-- ------------------------------------------------------------
update public.badges
   set description = 'Joined VibeGrounds before October 2026. Never obtainable again.',
       criteria    = '{"type":"joined_before","value":"2026-10-01T00:00:00Z"}'::jsonb
 where slug = 'og-member';


-- ============================================================
-- CHECK IT WORKED
-- ============================================================
-- select value from public.site_settings where key = 'og_badge_cutoff';
--   -- "2026-10-01T00:00:00Z"
--
-- select description, criteria, retires_at from public.badges where slug = 'og-member';
--   -- description and criteria say October 2026; retires_at still 2027-01-01
--
-- Nobody should have lost it:
-- select count(*) from public.user_badges where badge_slug = 'og-member';
--   -- same as before this ran
--
-- To change the deadline again before it passes:
--   select public.admin_set_setting('og_badge_cutoff', '"2026-11-01T00:00:00Z"'::jsonb);
--   -- and update the description above to match, or the site lies.
-- ============================================================
