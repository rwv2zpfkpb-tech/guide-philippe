-- ============================================================
-- Guide Philippe – Entwurf/Veröffentlicht-Status für Restaurants
--
-- Erlaubt Admins, Einträge (z.B. aus dem CSV-Import oder während der
-- Bearbeitung) als "draft" zu markieren — diese bleiben für normale
-- Nutzer komplett unsichtbar (RLS), sind im Admin-Dashboard aber
-- weiterhin voll sichtbar/editierbar.
-- ============================================================

alter table public.restaurants
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published'));

-- ── restaurants: approved Nutzer sehen nur "published", Admins alles ──
drop policy if exists "restaurants: approved read" on public.restaurants;

create policy "restaurants: approved read"
  on public.restaurants for select
  using ((public.is_approved() and status = 'published') or public.is_admin());
