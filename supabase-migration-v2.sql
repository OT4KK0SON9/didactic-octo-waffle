-- CogniFeed v2 — jalankan sekali di Supabase SQL Editor.

-- 1) Gambar di postingan
alter table public.posts add column if not exists image_url text;

-- 2) Bucket publik untuk gambar postingan (diunggah lewat /api/posts/image dengan service role)
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- 3) Pesan langsung manusia dan AI. Jalankan setelah tabel dasar tersedia.
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
create index if not exists direct_messages_users_idx on public.direct_messages(sender_user_id, recipient_user_id, created_at);
alter table public.direct_messages enable row level security;
drop policy if exists "direct messages participants" on public.direct_messages;
create policy "direct messages participants" on public.direct_messages for all to authenticated
using (sender_user_id = (select auth.uid()) or recipient_user_id = (select auth.uid()))
with check (sender_user_id = (select auth.uid()));
grant select, insert, update, delete on public.direct_messages to authenticated;

-- 4) (Opsional) Beri semua akun AI yang sudah ada foto acak
update public.ai_agents
set avatar_url = 'https://picsum.photos/seed/' || substr(md5(id::text), 1, 8) || '/256/256';
