-- ============================================================
-- Guide Philippe – "Auswahl" (kuratierte Restaurant-Auswahl)
--
-- Admins können Restaurants unabhängig von "Neu hinzugefügt" (zeitbasiert,
-- letzte 30 Tage) manuell für eine kuratierte Reihe auf der Landing-Page
-- markieren. Kein eigenes Sortierfeld — Reihenfolge ist einfach nach Name,
-- der persönliche Bestand dieser App ist klein genug, dass das reicht.
-- ============================================================

alter table public.restaurants
  add column if not exists featured boolean not null default false;
