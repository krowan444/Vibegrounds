-- ============================================================
-- VIBEGROUNDS — 06: REVIEWS & FORUM
-- Comments are tied to real verified accounts now. Accountability
-- is what lets the rest of the site stay loose.
-- ============================================================

-- ------------------------------------------------------------
-- REVIEWS (comments on a submission)
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  status      text not null default 'visible' check (status in ('visible','removed')),
  removed_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_reviews_creation on public.reviews (creation_id, created_at desc);
create index if not exists idx_reviews_author   on public.reviews (author_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Visible reviews are public" on public.reviews;
create policy "Visible reviews are public"
  on public.reviews for select
  using (status = 'visible' or auth.uid() = author_id or public.is_staff());

drop policy if exists "Verified members can review" on public.reviews;
create policy "Verified members can review"
  on public.reviews for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
  );

drop policy if exists "Authors can edit own reviews" on public.reviews;
create policy "Authors can edit own reviews"
  on public.reviews for update
  using (auth.uid() = author_id and status = 'visible')
  with check (auth.uid() = author_id);

drop policy if exists "Staff can moderate reviews" on public.reviews;
create policy "Staff can moderate reviews"
  on public.reviews for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authors and staff can delete reviews" on public.reviews;
create policy "Authors and staff can delete reviews"
  on public.reviews for delete
  using (auth.uid() = author_id or public.is_staff());

-- Comment flood control: 1 review per creation per user per 30s, 20/hour overall
create or replace function public.check_review_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.reviews
              where author_id = new.author_id and created_at > now() - interval '30 seconds') then
    raise exception 'Slow down — one comment every 30 seconds.';
  end if;
  if (select count(*) from public.reviews
       where author_id = new.author_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Hourly comment limit reached.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_rate_limit on public.reviews;
create trigger trg_review_rate_limit
  before insert on public.reviews
  for each row execute function public.check_review_rate_limit();

-- Keep creations.review_count accurate
create or replace function public.on_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('vg.privileged', 'on', true);
  update public.creations c
     set review_count = (select count(*) from public.reviews r
                          where r.creation_id = c.id and r.status = 'visible')
   where c.id = coalesce(new.creation_id, old.creation_id);
  perform set_config('vg.privileged', 'off', true);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_change on public.reviews;
create trigger trg_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

create or replace view public.reviews_public
with (security_invoker = on) as
select r.id, r.creation_id, r.body, r.created_at, r.updated_at, r.author_id,
       p.username as author_username, p.avatar_url as author_avatar, p.role as author_role
from public.reviews r
join public.profiles p on p.id = r.author_id
where r.status = 'visible';

grant select on public.reviews_public to anon, authenticated;

-- ------------------------------------------------------------
-- REACTIONS (quick emoji, one per member per type)
-- ------------------------------------------------------------
create table if not exists public.reactions (
  creation_id   uuid not null references public.creations(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire','like','clever','funny','cursed')),
  created_at    timestamptz not null default now(),
  primary key (creation_id, user_id, reaction_type)
);

create index if not exists idx_reactions_creation on public.reactions (creation_id);

alter table public.reactions enable row level security;

drop policy if exists "Reactions are publicly readable" on public.reactions;
create policy "Reactions are publicly readable" on public.reactions for select using (true);

drop policy if exists "Members can react" on public.reactions;
create policy "Members can react"
  on public.reactions for insert
  with check (auth.uid() = user_id and public.is_active_member());

drop policy if exists "Members can unreact" on public.reactions;
create policy "Members can unreact"
  on public.reactions for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- FORUM
-- ------------------------------------------------------------
create table if not exists public.forum_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text default '',
  icon        text default '💬',
  sort_order  int default 0,
  is_staff_only boolean default false,
  created_at  timestamptz default now()
);

insert into public.forum_categories (slug, name, description, icon, sort_order) values
  ('announcements','Announcements','News from the VibeGrounds crew.','📢',0),
  ('general',      'General Discussion','Talk about anything and everything.','💬',1),
  ('vibe-coding',  'Vibe Coding','Prompts, stacks, tricks and horrible hacks.','⌨️',2),
  ('show-project', 'Show Your Project','Share what you built and get feedback.','🚀',3),
  ('help-feedback','Help & Feedback','Ask questions and help fellow vibers.','🆘',4),
  ('retro-internet','Retro Internet','Nostalgia, old-school web, and early internet culture.','📼',5)
on conflict (slug) do nothing;

alter table public.forum_categories enable row level security;
drop policy if exists "Forum categories are public" on public.forum_categories;
create policy "Forum categories are public" on public.forum_categories for select using (true);

create table if not exists public.forum_threads (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.forum_categories(id) on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 200),
  body             text not null check (char_length(body) between 1 and 10000),
  status           text not null default 'visible' check (status in ('visible','removed')),
  is_pinned        boolean default false,
  is_locked        boolean default false,
  reply_count      int default 0,
  view_count       int default 0,
  last_activity_at timestamptz default now(),
  created_at       timestamptz default now()
);

create index if not exists idx_threads_category on public.forum_threads (category_id, is_pinned desc, last_activity_at desc);
create index if not exists idx_threads_author   on public.forum_threads (author_id);

alter table public.forum_threads enable row level security;

drop policy if exists "Visible threads are public" on public.forum_threads;
create policy "Visible threads are public"
  on public.forum_threads for select
  using (status = 'visible' or auth.uid() = author_id or public.is_staff());

drop policy if exists "Verified members can post threads" on public.forum_threads;
create policy "Verified members can post threads"
  on public.forum_threads for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
    and not exists (select 1 from public.forum_categories fc
                     where fc.id = category_id and fc.is_staff_only and not public.is_staff())
  );

drop policy if exists "Authors can edit own threads" on public.forum_threads;
create policy "Authors can edit own threads"
  on public.forum_threads for update
  using (auth.uid() = author_id and status = 'visible' and is_locked = false)
  with check (auth.uid() = author_id);

drop policy if exists "Staff can moderate threads" on public.forum_threads;
create policy "Staff can moderate threads"
  on public.forum_threads for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authors and staff can delete threads" on public.forum_threads;
create policy "Authors and staff can delete threads"
  on public.forum_threads for delete using (auth.uid() = author_id or public.is_staff());

create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.forum_threads(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 10000),
  status     text not null default 'visible' check (status in ('visible','removed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_posts_thread on public.forum_posts (thread_id, created_at asc);
create index if not exists idx_posts_author on public.forum_posts (author_id);

alter table public.forum_posts enable row level security;

drop policy if exists "Visible posts are public" on public.forum_posts;
create policy "Visible posts are public"
  on public.forum_posts for select
  using (status = 'visible' or auth.uid() = author_id or public.is_staff());

drop policy if exists "Verified members can reply" on public.forum_posts;
create policy "Verified members can reply"
  on public.forum_posts for insert
  with check (
    auth.uid() = author_id
    and public.is_active_member()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_muted)
    and not exists (select 1 from public.forum_threads t where t.id = thread_id and t.is_locked)
  );

drop policy if exists "Authors can edit own posts" on public.forum_posts;
create policy "Authors can edit own posts"
  on public.forum_posts for update
  using (auth.uid() = author_id and status = 'visible')
  with check (auth.uid() = author_id);

drop policy if exists "Staff can moderate posts" on public.forum_posts;
create policy "Staff can moderate posts"
  on public.forum_posts for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authors and staff can delete posts" on public.forum_posts;
create policy "Authors and staff can delete posts"
  on public.forum_posts for delete using (auth.uid() = author_id or public.is_staff());

create or replace function public.handle_new_forum_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.forum_threads t
     set reply_count = (select count(*) from public.forum_posts p
                         where p.thread_id = t.id and p.status = 'visible'),
         last_activity_at = now()
   where t.id = coalesce(new.thread_id, old.thread_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_forum_post_created on public.forum_posts;
create trigger on_forum_post_created
  after insert or update or delete on public.forum_posts
  for each row execute function public.handle_new_forum_post();

-- Staff: hide/restore any user content in one call
create or replace function public.admin_set_content_status(
  p_type   text,
  p_id     uuid,
  p_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Moderators only.'; end if;
  if p_status not in ('visible','removed') then raise exception 'Invalid status.'; end if;

  if p_type = 'review' then
    update public.reviews set status = p_status, removed_by = auth.uid() where id = p_id;
  elsif p_type = 'thread' then
    update public.forum_threads set status = p_status where id = p_id;
  elsif p_type = 'post' then
    update public.forum_posts set status = p_status where id = p_id;
  else
    raise exception 'Unknown content type %', p_type;
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'set_content_status', p_type, p_id, p_status || ': ' || coalesce(p_reason,''));
end;
$$;

grant execute on function public.admin_set_content_status(text,uuid,text,text) to authenticated;
