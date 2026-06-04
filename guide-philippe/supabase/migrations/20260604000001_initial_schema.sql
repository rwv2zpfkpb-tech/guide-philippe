-- ============================================================
-- Guide Philippe – initial schema
-- Run this in the Supabase SQL editor (or via supabase db push)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: mirrors auth.users, adds role
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Auto-create a blank profile whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- restaurants
-- spoon_rating values:
--   0 = 🫗 Not Recommended
--   1 = 🥄 Remembering
--   2 = 🍴 Worth Mentioning
--   3 = 🍽️ Absolute Recommendation
create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address         text not null,
  lat             double precision,
  lng             double precision,
  cuisine         text,
  price_level     smallint check (price_level between 1 and 4),
  spoon_rating    smallint not null default 0 check (spoon_rating between 0 and 3),
  official_review text,
  image_url       text,
  created_at      timestamptz not null default now()
);

-- comments
create table public.comments (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  content          text not null,
  secondary_rating smallint check (secondary_rating between 1 and 5),
  created_at       timestamptz not null default now()
);

-- data_sources: Google Maps lists to auto-import from
create table public.data_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text not null,
  freq        text not null default 'daily'
                check (freq in ('manual', 'hourly', 'daily', 'weekly')),
  status      text not null default 'pending'
                check (status in ('pending', 'syncing', 'synced', 'error')),
  last_sync   timestamptz,
  entry_count int not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.restaurants  enable row level security;
alter table public.comments     enable row level security;
alter table public.data_sources enable row level security;

-- Helper function reused by all admin policies
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from   public.profiles
    where  id = auth.uid()
    and    role = 'admin'
  );
$$;

-- ── profiles ──────────────────────────────────────────────────
create policy "profiles: public read"
  on public.profiles for select
  using (true);

create policy "profiles: self update"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ── restaurants ───────────────────────────────────────────────
create policy "restaurants: public read"
  on public.restaurants for select
  using (true);

create policy "restaurants: admin insert"
  on public.restaurants for insert
  with check (public.is_admin());

create policy "restaurants: admin update"
  on public.restaurants for update
  using     (public.is_admin())
  with check (public.is_admin());

create policy "restaurants: admin delete"
  on public.restaurants for delete
  using (public.is_admin());

-- ── comments ──────────────────────────────────────────────────
create policy "comments: public read"
  on public.comments for select
  using (true);

-- Authenticated users may insert only under their own user_id
create policy "comments: authenticated insert"
  on public.comments for insert
  with check (auth.uid() = user_id and auth.uid() is not null);

create policy "comments: self update"
  on public.comments for update
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner or admin may delete
create policy "comments: self or admin delete"
  on public.comments for delete
  using (auth.uid() = user_id or public.is_admin());

-- ── data_sources ──────────────────────────────────────────────
create policy "data_sources: admin all"
  on public.data_sources for all
  using     (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- STORAGE
-- ============================================================

-- Public bucket for restaurant hero images
insert into storage.buckets (id, name, public)
  values ('restaurant-images', 'restaurant-images', true)
  on conflict (id) do nothing;

-- Anyone can view images
create policy "storage: public read"
  on storage.objects for select
  using (bucket_id = 'restaurant-images');

-- Only admins may upload
create policy "storage: admin upload"
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-images'
    and public.is_admin()
  );

-- Only admins may replace
create policy "storage: admin update"
  on storage.objects for update
  using (
    bucket_id = 'restaurant-images'
    and public.is_admin()
  );

-- Only admins may delete
create policy "storage: admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-images'
    and public.is_admin()
  );
