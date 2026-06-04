-- ============================================================
-- Guide Philippe – Google Places integration
-- Adds google_place_id; removes address and image_url since
-- those are now fetched live from the Google Places API.
-- ============================================================

-- 1. Add the new column as nullable first so existing rows survive
alter table public.restaurants
  add column if not exists google_place_id text;

-- Add the unique constraint separately
alter table public.restaurants
  add constraint restaurants_google_place_id_key unique (google_place_id);

-- 2. Drop the columns that Google now provides dynamically
alter table public.restaurants
  drop column if exists address,
  drop column if exists image_url;

-- ── Notes ──────────────────────────────────────────────────────────────────────
-- google_place_id is left nullable so you can backfill existing rows:
--   UPDATE restaurants SET google_place_id = '...' WHERE id = '...';
-- Once all rows are backfilled, enforce NOT NULL with:
--   ALTER TABLE public.restaurants ALTER COLUMN google_place_id SET NOT NULL;
