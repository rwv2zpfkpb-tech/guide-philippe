// Haversine great-circle ("Luftlinie") distance between two lat/lng points,
// in kilometers. There's no PostGIS/geography column in Supabase here, so
// distance-based sorting/filtering happens against the already-fetched
// restaurant list (see app/page.tsx, SearchResultsView.tsx) rather than in
// the DB query.
export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A location search (typed address, selected place, or "Standort
// verwenden") only ever excludes restaurants beyond this straight-line
// radius — deliberately generous (covers a whole metro area, e.g. Berlin
// end-to-end) so it never depends on Google's per-place viewport size
// (city vs. single street, s. Roadmap-Schritt 16/17), while still keeping
// an address search in one city from pulling in restaurants from a
// completely different one.
export const MAX_SEARCH_RADIUS_KM = 30;

// German-locale distance label for a "Luftlinie" figure — meters below 1km
// (more legible than "0,3 km" for short distances), one decimal otherwise.
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}
