-- ============================================================
-- Guide Philippe – Aufenthalte/Reviews, Kategorie-Bewertungen,
-- Nutzer-Sterne 0–5, Entfernung des Self-Hosting-Storage-Backends
--
-- Idempotent geschrieben (IF EXISTS/IF NOT EXISTS überall, Backfill
-- übersprungen wo bereits vorhanden) — sicher erneut ausführbar, falls
-- ein vorheriger Lauf mittendrin abgebrochen ist.
-- ============================================================

-- ── restaurant_reviews (ein redaktioneller Aufenthalt) ─────────
create table if not exists public.restaurant_reviews (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  visited_at    date not null default current_date,
  spoon_rating  smallint not null check (spoon_rating between 0 and 3),
  fazit         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists restaurant_reviews_restaurant_id_idx
  on public.restaurant_reviews (restaurant_id);

-- ── restaurant_review_categories (Service/Location/Geschmack/Preis-Leistung) ──
create table if not exists public.restaurant_review_categories (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.restaurant_reviews(id) on delete cascade,
  category   text not null check (category in ('service', 'location', 'geschmack', 'preis_leistung')),
  heading    text,
  body       text,
  rating     smallint check (rating between 0 and 5),
  unique (review_id, category)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.restaurant_reviews           enable row level security;
alter table public.restaurant_review_categories  enable row level security;

drop policy if exists "restaurant_reviews: approved read" on public.restaurant_reviews;
create policy "restaurant_reviews: approved read"
  on public.restaurant_reviews for select
  using (public.is_approved() or public.is_admin());

drop policy if exists "restaurant_reviews: admin insert" on public.restaurant_reviews;
create policy "restaurant_reviews: admin insert"
  on public.restaurant_reviews for insert
  with check (public.is_admin());

drop policy if exists "restaurant_reviews: admin update" on public.restaurant_reviews;
create policy "restaurant_reviews: admin update"
  on public.restaurant_reviews for update
  using     (public.is_admin())
  with check (public.is_admin());

drop policy if exists "restaurant_reviews: admin delete" on public.restaurant_reviews;
create policy "restaurant_reviews: admin delete"
  on public.restaurant_reviews for delete
  using (public.is_admin());

drop policy if exists "restaurant_review_categories: approved read" on public.restaurant_review_categories;
create policy "restaurant_review_categories: approved read"
  on public.restaurant_review_categories for select
  using (public.is_approved() or public.is_admin());

drop policy if exists "restaurant_review_categories: admin insert" on public.restaurant_review_categories;
create policy "restaurant_review_categories: admin insert"
  on public.restaurant_review_categories for insert
  with check (public.is_admin());

drop policy if exists "restaurant_review_categories: admin update" on public.restaurant_review_categories;
create policy "restaurant_review_categories: admin update"
  on public.restaurant_review_categories for update
  using     (public.is_admin())
  with check (public.is_admin());

drop policy if exists "restaurant_review_categories: admin delete" on public.restaurant_review_categories;
create policy "restaurant_review_categories: admin delete"
  on public.restaurant_review_categories for delete
  using (public.is_admin());

-- ============================================================
-- BACKFILL — jedes bestehende Restaurant bekommt genau einen
-- initialen Aufenthalt, damit die Invariante "≥1 Review pro
-- Restaurant" danach immer gilt. Übersprungen für Restaurants, die
-- (z.B. durch einen vorherigen Teil-Lauf dieser Migration) bereits
-- eine Review-Zeile haben. In dynamischem SQL, da "official_review"
-- weiter unten in diesem Lauf gedroppt wird — bei einem erneuten Lauf
-- nach einem bereits abgeschlossenen Durchlauf existiert die Spalte
-- nicht mehr, ein statisches SELECT r.official_review würde dann beim
-- Planen fehlschlagen (unabhängig davon, ob die WHERE-Klausel ohnehin
-- 0 Zeilen liefern würde).
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurants' and column_name = 'official_review'
  ) then
    insert into public.restaurant_reviews (restaurant_id, visited_at, spoon_rating, fazit)
    select r.id, r.created_at::date, r.spoon_rating, coalesce(r.official_review, '')
    from public.restaurants r
    where not exists (select 1 from public.restaurant_reviews rr where rr.restaurant_id = r.id);
  else
    insert into public.restaurant_reviews (restaurant_id, visited_at, spoon_rating, fazit)
    select r.id, r.created_at::date, r.spoon_rating, ''
    from public.restaurants r
    where not exists (select 1 from public.restaurant_reviews rr where rr.restaurant_id = r.id);
  end if;
end $$;

-- ============================================================
-- TRIGGER — restaurants.spoon_rating bleibt als schnell filter-
-- bare, denormalisierte Spalte erhalten, wird aber ab jetzt immer
-- aus dem aktuellsten Aufenthalt (höchstes visited_at, dann
-- created_at) abgeleitet statt direkt editiert.
-- ============================================================

create or replace function public.sync_restaurant_spoon_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid;
  latest_rating smallint;
begin
  target_restaurant_id := coalesce(new.restaurant_id, old.restaurant_id);

  select spoon_rating into latest_rating
  from public.restaurant_reviews
  where restaurant_id = target_restaurant_id
  order by visited_at desc, created_at desc
  limit 1;

  if latest_rating is not null then
    update public.restaurants set spoon_rating = latest_rating where id = target_restaurant_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_restaurant_spoon_rating on public.restaurant_reviews;
create trigger trg_sync_restaurant_spoon_rating
  after insert or update or delete on public.restaurant_reviews
  for each row execute function public.sync_restaurant_spoon_rating();

-- ── restaurants: official_review wird durch restaurant_reviews.fazit ersetzt ──
alter table public.restaurants drop column if exists official_review;

-- ── comments: Sterne-Skala von 1–5 auf 0–5 erweitern ────────────
alter table public.comments drop constraint if exists comments_secondary_rating_check;
alter table public.comments
  add constraint comments_secondary_rating_check check (secondary_rating between 0 and 5);

-- ============================================================
-- Totes Self-Hosting-Storage-Backend entfernen — Bilder kommen
-- ausschließlich live von der Google Places API (app/actions/places.ts).
-- Der "restaurant-images"-Bucket war nie an eine Upload-UI angebunden.
--
-- Hinweis: storage.objects/storage.buckets lassen sich nicht per
-- direktem SQL DELETE ändern (Supabase blockiert das zugunsten der
-- Storage API, SQLSTATE 42501). Die Policies werden hier trotzdem
-- entfernt (normales DDL, kein Storage-API-Zwang) — der leere,
-- policy-lose Bucket bleibt bestehen und ist dadurch für niemanden
-- außer dem Service-Role-Key erreichbar. Falls gewünscht, den Bucket
-- manuell im Supabase Dashboard (Storage → restaurant-images → Delete)
-- oder per `supabase storage rm` entfernen.
-- ============================================================

drop policy if exists "storage: public read"   on storage.objects;
drop policy if exists "storage: admin upload"  on storage.objects;
drop policy if exists "storage: admin update"  on storage.objects;
drop policy if exists "storage: admin delete"  on storage.objects;
