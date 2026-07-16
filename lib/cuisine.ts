// Turns a Google Places "type" into a best-effort cuisine guess. Shared
// between the client-side admin autocomplete (components/admin/PlacesAutocomplete.tsx,
// Places JS SDK objects) and the server-side CSV-import place resolution
// (app/actions/places.ts, Places REST API JSON) — both feed the same shape
// of primaryTypeDisplayName/primaryType/types fields into guessCuisine, so
// the heuristic only needs to live once.

// Google place "types" that carry no cuisine information — skip these when
// looking for a usable type to turn into a cuisine guess.
const GENERIC_PLACE_TYPES = new Set([
  "restaurant", "food", "point_of_interest", "establishment", "store",
]);

function prettifyPlaceType(type: string): string {
  return type
    .replace(/_restaurant$/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Turns a Google primary-type display name / type id / types list into a
// short, human cuisine label (e.g. "italian_restaurant" → "Italian").
// Returns null when nothing usable is available — the admin fills it in by hand.
export function guessCuisine(
  primaryTypeDisplayName?: string | null,
  primaryType?: string | null,
  types?: string[] | null
): string | null {
  if (primaryTypeDisplayName?.trim()) {
    return primaryTypeDisplayName.replace(/\s*restaurant$/i, "").trim() || primaryTypeDisplayName;
  }
  const candidate =
    (primaryType && !GENERIC_PLACE_TYPES.has(primaryType) ? primaryType : null) ??
    types?.find((t) => t.endsWith("_restaurant") && !GENERIC_PLACE_TYPES.has(t));
  return candidate ? prettifyPlaceType(candidate) : null;
}
