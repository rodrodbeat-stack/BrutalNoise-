-- NEURAL AUDIO 2050 / Supabase bootstrap
-- Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_path text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint posts_content_or_media check (length(trim(content)) > 0 or media_path is not null)
);
do $ begin
  alter table public.posts add constraint posts_profile_fk foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null;
end $;
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check (follower_id <> following_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || substr(new.id::text,1,8)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,''),'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable" on public.posts for select to anon, authenticated using (true);
drop policy if exists "Signed-in users create own posts" on public.posts;
create policy "Signed-in users create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors update own posts" on public.posts;
create policy "Authors update own posts" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authors delete own posts" on public.posts;
create policy "Authors delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Comments are publicly readable" on public.comments;
create policy "Comments are publicly readable" on public.comments for select to anon, authenticated using (true);
drop policy if exists "Signed-in users add own comments" on public.comments;
create policy "Signed-in users add own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own comments" on public.comments;
create policy "Users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Likes are publicly readable" on public.likes;
create policy "Likes are publicly readable" on public.likes for select to anon, authenticated using (true);
drop policy if exists "Users add own likes" on public.likes;
create policy "Users add own likes" on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes" on public.likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Follows are publicly readable" on public.follows;
create policy "Follows are publicly readable" on public.follows for select to anon, authenticated using (true);
drop policy if exists "Users create own follows" on public.follows;
create policy "Users create own follows" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists "Users remove own follows" on public.follows;
create policy "Users remove own follows" on public.follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "Chat is readable" on public.chat_messages;
create policy "Chat is readable" on public.chat_messages for select to authenticated using (true);
drop policy if exists "Signed-in users send chat" on public.chat_messages;
create policy "Signed-in users send chat" on public.chat_messages for insert to authenticated with check (auth.uid() = user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('neural-media','neural-media',true,104857600,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true, file_size_limit=104857600;

drop policy if exists "Public can view neural media" on storage.objects;
create policy "Public can view neural media" on storage.objects for select to anon, authenticated using (bucket_id='neural-media');
drop policy if exists "Authenticated users upload own neural media" on storage.objects;
create policy "Authenticated users upload own neural media" on storage.objects for insert to authenticated with check (bucket_id='neural-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own neural media" on storage.objects;
create policy "Users update own neural media" on storage.objects for update to authenticated using (bucket_id='neural-media' and owner_id=auth.uid()::text) with check (bucket_id='neural-media' and owner_id=auth.uid()::text);
drop policy if exists "Users delete own neural media" on storage.objects;
create policy "Users delete own neural media" on storage.objects for delete to authenticated using (bucket_id='neural-media' and owner_id=auth.uid()::text);

grant select on public.profiles, public.posts, public.comments, public.likes, public.follows to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.comments, public.likes, public.follows to authenticated;
grant select, insert on public.chat_messages to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
