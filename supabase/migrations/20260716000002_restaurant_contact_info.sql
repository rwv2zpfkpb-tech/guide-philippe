-- ============================================================
-- Guide Philippe – Telefonnummer, Website, manuelle Öffnungszeiten
--
-- Wie schon die Adresse (20260716000001) werden Telefonnummer und
-- Website standardmäßig live von Google Places bezogen, aber zusätzlich
-- persistiert — als Fallback für manuell erfasste Restaurants (kein
-- google_place_id) und für den Fall, dass der Live-Lookup fehlschlägt
-- oder Google die Angabe schlicht nicht kennt/der Admin sie korrigieren
-- will.
--
-- opening_hours ist ein rein manuelles Freitextfeld (z. B.
-- "Mo–Fr 12–22 Uhr, Sa/So geschlossen") — es gibt keine Live-Quelle dafür
-- außer Googles regularOpeningHours, die weiterhin Vorrang hat, wenn sie
-- verfügbar ist (s. app/restaurant/[id]/page.tsx).
-- ============================================================

alter table public.restaurants
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists opening_hours text;
