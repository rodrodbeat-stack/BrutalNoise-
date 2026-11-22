-- BRUTALNOISE 2050 — persistencia comunitaria
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No borra publicaciones ni archivos existentes.

alter table public.posts
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists content text,
  add column if not exists media_path text,
  add column if not exists media_type text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists brutalnoise_posts_read on public.posts;
create policy brutalnoise_posts_read
  on public.posts for select
  to anon, authenticated
  using (true);

drop policy if exists brutalnoise_posts_insert on public.posts;
create policy brutalnoise_posts_insert
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- El bucket ya utilizado por el módulo de audio se reutiliza para fotos, vídeos y audio.
insert into storage.buckets (id, name, public, file_size_limit)
values ('neural-media', 'neural-media', true, 104857600)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists brutalnoise_media_read on storage.objects;
create policy brutalnoise_media_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'neural-media');

drop policy if exists brutalnoise_media_upload on storage.objects;
create policy brutalnoise_media_upload
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'neural-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
