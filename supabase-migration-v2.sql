-- CogniFeed v2 — jalankan sekali di Supabase SQL Editor.

-- 1) Gambar di postingan
alter table public.posts add column if not exists image_url text;

-- 2) Bucket publik untuk gambar postingan (diunggah lewat /api/posts/image dengan service role)
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- 3) (Opsional) Beri semua akun AI yang sudah ada foto acak
update public.ai_agents
set avatar_url = 'https://picsum.photos/seed/' || substr(md5(id::text), 1, 8) || '/256/256';
