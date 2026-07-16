-- ============================================================
-- Guide Philippe – Adresse als eigenes Feld speichern
--
-- Bisher wurde die Adresse nie in der DB abgelegt (nur live von der
-- Google Places API bezogen). Damit Restaurants ohne google_place_id
-- (manuelle Erfassung) und die Detailseite auch ohne funktionierenden
-- Places-Lookup eine Adresse anzeigen können, wird sie jetzt zusätzlich
-- persistiert (bei Auswahl über Places-Autocomplete oder manueller
-- Eingabe im Admin-Dashboard).
-- ============================================================

alter table public.restaurants
  add column if not exists address text;
