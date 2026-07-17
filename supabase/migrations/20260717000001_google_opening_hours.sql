-- ============================================================
-- Guide Philippe – Google-Öffnungszeiten persistieren
--
-- Bisher wurden Adresse/Telefon/Website/Öffnungszeiten bei jedem
-- öffentlichen Seitenaufruf live von der Google Places API nachgeladen
-- (Live-Wert hatte immer Vorrang vor der gespeicherten Fallback-Spalte).
-- Das kostet unnötig Places-API-Requests für Infos, die sich kaum
-- ändern. Adresse/Telefon/Website haben bereits Spalten (20260716000001,
-- 20260716000002) — nur Öffnungszeiten fehlt eine Spalte für Googles
-- strukturierte "Tag: Zeiten"-Liste (weekdayDescriptions), da
-- `opening_hours` bereits als rein manuelles Freitextfeld belegt ist.
--
-- google_opening_hours ist rein Google-abgeleitet (nicht admin-editierbar,
-- wird bei Places-Autocomplete-Auswahl/CSV-Import/"Von Google
-- synchronisieren" automatisch befüllt) — im Gegensatz zu opening_hours,
-- das der manuelle Fallback bleibt, wenn google_opening_hours leer ist.
-- ============================================================

alter table public.restaurants
  add column if not exists google_opening_hours text[];
