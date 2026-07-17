-- ============================================================
-- Guide Philippe – Verfallsdatum für persistierte Google-Places-Daten
--
-- Seit 20260717000001 werden Adresse/Telefon/Website/Öffnungszeiten aus der
-- DB statt live von Google gelesen (s. CLAUDE.md Roadmap-Schritt 18).
-- google_synced_at hält fest, wann eine Zeile zuletzt tatsächlich mit Google
-- abgeglichen wurde — GOOGLE_DATA_STALE_DAYS (lib/googleSync.ts, 180 Tage /
-- ~6 Monate) bestimmt, ab wann ein Eintrag als veraltet gilt und beim
-- nächsten Besuch der Restaurant-Detailseite automatisch aufgefrischt wird
-- (refreshGooglePlaceDataIfStale() in app/actions/restaurants.ts), statt für
-- immer auf dem einmal gespeicherten Stand zu bleiben.
-- ============================================================

alter table public.restaurants
  add column if not exists google_synced_at timestamptz;
