// Wie lange gespeicherte Google-Places-Daten (Adresse/Telefon/Website/
// Öffnungszeiten, s. restaurants.google_synced_at) als "frisch genug" gelten,
// bevor sie beim nächsten Restaurant-Detailseiten-Besuch automatisch
// aufgefrischt werden (refreshGooglePlaceDataIfStale() in
// app/actions/restaurants.ts). ~6 Monate — lang genug, dass es keine
// spürbare Request-Last erzeugt, kurz genug, dass Adresse/Telefon/Website
// nicht über Jahre veraltet bleiben.
export const GOOGLE_DATA_STALE_DAYS = 180;

export function isGoogleDataStale(
  syncedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!syncedAt) return true;
  const ageMs = now.getTime() - new Date(syncedAt).getTime();
  return ageMs > GOOGLE_DATA_STALE_DAYS * 24 * 60 * 60 * 1000;
}
