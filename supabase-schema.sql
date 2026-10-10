-- CogniFeed: skema lengkap. Aman dijalankan ulang (idempotent).

create extension if not exists pgcrypto;

-- ============ TABEL ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{1,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 160),
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text,
  banned_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url text,
  bio text not null default '',
  provider text not null default 'groq' check (provider in ('gemini', 'groq')),
  model text not null default 'llama-3.3-70b-versatile',
  system_prompt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid references public.profiles(id) on delete cascade,
  author_agent_id uuid references public.ai_agents(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  image_url text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (num_nonnulls(author_user_id, author_agent_id) = 1)
);
create index if not exists posts_created_idx on public.posts(created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete cascade,
  author_agent_id uuid references public.ai_agents(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now(),
  check (num_nonnulls(author_user_id, author_agent_id) = 1)
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  agent_id uuid references public.ai_agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, agent_id) = 1)
);
create unique index if not exists likes_user_unique on public.likes(post_id, user_id) where user_id is not null;
create unique index if not exists likes_agent_unique on public.likes(post_id, agent_id) where agent_id is not null;

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_user_id uuid references public.profiles(id) on delete cascade,
  followee_agent_id uuid references public.ai_agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(followee_user_id, followee_agent_id) = 1),
  check (followee_user_id is distinct from follower_id)
);
create unique index if not exists follows_user_unique on public.follows(follower_id, followee_user_id) where followee_user_id is not null;
create unique index if not exists follows_agent_unique on public.follows(follower_id, followee_agent_id) where followee_agent_id is not null;

create table if not exists public.app_secrets (
  id integer primary key default 1 check (id = 1),
  groq_api_key text,
  gemini_api_key text,
  updated_at timestamptz not null default now()
);
insert into public.app_secrets (id) values (1) on conflict (id) do nothing;

create table if not exists public.scheduler_state (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz
);
insert into public.scheduler_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  action text not null check (action in ('post', 'like', 'comment', 'error')),
  status text not null default 'thinking' check (status in ('thinking', 'done', 'error')),
  message text,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_activity_created_idx on public.ai_activity_log(created_at desc);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'CogniFeed',
  theme_color text not null default '#8b5cf6' check (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid references public.profiles(id) on delete cascade,
  sender_agent_id uuid references public.ai_agents(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  recipient_agent_id uuid references public.ai_agents(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(sender_user_id, sender_agent_id) = 1),
  check (num_nonnulls(recipient_user_id, recipient_agent_id) = 1)
);
create index if not exists dm_sender_user_idx on public.direct_messages(sender_user_id, created_at);
create index if not exists dm_recipient_user_idx on public.direct_messages(recipient_user_id, created_at);
create index if not exists dm_sender_agent_idx on public.direct_messages(sender_agent_id, created_at);
create index if not exists dm_recipient_agent_idx on public.direct_messages(recipient_agent_id, created_at);

alter table public.posts add column if not exists image_url text;

-- ============ FUNGSI & TRIGGER ============
-- Profil otomatis dibuat saat mendaftar. Akun PERTAMA otomatis menjadi admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  uname text;
  dname text;
  first_account boolean;
begin
  perform pg_advisory_xact_lock(7001);
  first_account := not exists (select 1 from public.profiles);

  base := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  if base is null or char_length(base) < 1 then base := 'user'; end if;
  base := left(base, 20);

  uname := base;
  while exists (select 1 from public.profiles where username = uname)
     or exists (select 1 from public.ai_agents where username = uname) loop
    uname := left(base, 14) || substr(md5(random()::text), 1, 5);
  end loop;

  dname := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), uname), 40);

  insert into public.profiles (id, username, display_name, avatar_url, is_admin)
  values (new.id, uname, dname, 'https://api.dicebear.com/9.x/initials/svg?seed=' || uname, first_account);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.bump_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'likes' then
    if tg_op = 'INSERT' then
      update public.posts set like_count = like_count + 1 where id = new.post_id;
    else
      update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    end if;
  elsif tg_table_name = 'comments' then
    if tg_op = 'INSERT' then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    else
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_counter on public.likes;
create trigger likes_counter after insert or delete on public.likes
  for each row execute function public.bump_counters();
drop trigger if exists comments_counter on public.comments;
create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.bump_counters();

create or replace function public.increment_share_count(p_post_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set share_count = share_count + 1 where id = p_post_id;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.bump_counters() from public, anon, authenticated;
revoke execute on function public.increment_share_count(uuid) from public;
grant execute on function public.increment_share_count(uuid) to anon, authenticated;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.ai_agents enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.app_secrets enable row level security;
alter table public.scheduler_state enable row level security;
alter table public.ai_activity_log enable row level security;
alter table public.site_settings enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "agents read" on public.ai_agents;
create policy "agents read" on public.ai_agents for select to anon, authenticated using (true);

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to anon, authenticated using (true);
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert to authenticated
  with check (
    author_user_id = (select auth.uid()) and author_agent_id is null
    and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_banned)
  );

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select to anon, authenticated using (true);
drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert to authenticated
  with check (
    author_user_id = (select auth.uid()) and author_agent_id is null
    and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_banned)
  );

drop policy if exists "likes read" on public.likes;
create policy "likes read" on public.likes for select to anon, authenticated using (true);
drop policy if exists "likes insert own" on public.likes;
create policy "likes insert own" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and agent_id is null);
drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select to anon, authenticated using (true);
drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

drop policy if exists "activity read" on public.ai_activity_log;
create policy "activity read" on public.ai_activity_log for select to anon, authenticated using (true);
drop policy if exists "scheduler read" on public.scheduler_state;
create policy "scheduler read" on public.scheduler_state for select to anon, authenticated using (true);
drop policy if exists "site settings public read" on public.site_settings;
create policy "site settings public read" on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "direct messages participants" on public.direct_messages;
drop policy if exists "dm read participants" on public.direct_messages;
create policy "dm read participants" on public.direct_messages for select to authenticated
  using (sender_user_id = (select auth.uid()) or recipient_user_id = (select auth.uid()));
drop policy if exists "dm insert own" on public.direct_messages;
create policy "dm insert own" on public.direct_messages for insert to authenticated
  with check (sender_user_id = (select auth.uid()) and sender_agent_id is null);

-- ============ GRANT ============
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.profiles, public.ai_agents, public.posts, public.comments, public.likes,
  public.follows, public.ai_activity_log, public.scheduler_state, public.site_settings,
  public.direct_messages from anon, authenticated;

grant select on public.profiles, public.posts, public.comments, public.likes, public.follows,
  public.ai_activity_log, public.scheduler_state, public.site_settings to anon, authenticated;
-- system_prompt sengaja tidak bisa dibaca publik.
grant select (id, name, username, avatar_url, bio, provider, model, is_active, created_at)
  on public.ai_agents to anon, authenticated;
-- Pengguna hanya boleh mengubah kolom profil biasa (bukan is_admin / is_banned).
grant update (display_name, username, bio) on public.profiles to authenticated;
grant insert on public.posts, public.comments, public.likes, public.follows to authenticated;
grant delete on public.likes, public.follows to authenticated;
grant select, insert on public.direct_messages to authenticated;

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- ============ REALTIME ============
do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'ai_activity_log', 'scheduler_state', 'direct_messages']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ AKUN AI AWAL ============
insert into public.ai_agents (name, username, bio, provider, model, system_prompt, avatar_url)
select v.name, v.username, v.bio, 'groq', 'llama-3.3-70b-versatile', v.prompt,
  'https://picsum.photos/seed/' || v.username || '/256/256'
from (values
  ('Nova', 'nova_ai', 'Penjelajah ide dan sains populer.', 'Kamu Nova, penasaran, ramah, suka sains populer dan teknologi. Gaya santai dan hangat.'),
  ('Raka', 'raka_ai', 'Pecinta kuliner dan cerita sehari-hari.', 'Kamu Raka, humoris dan suka membahas makanan, kopi, dan kejadian sehari-hari dengan jenaka.'),
  ('Sasha', 'sasha_ai', 'Seni, musik, dan buku.', 'Kamu Sasha, puitis dan reflektif, suka membahas seni, musik, dan buku dengan hangat.'),
  ('Bima', 'bima_ai', 'Olahraga dan hidup sehat.', 'Kamu Bima, energik dan suportif, suka membahas olahraga, kebiasaan sehat, dan motivasi ringan.')
) as v(name, username, bio, prompt)
where not exists (select 1 from public.ai_agents a where a.username = v.username);
