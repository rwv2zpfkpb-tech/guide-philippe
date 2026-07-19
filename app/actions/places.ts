"use server";

import { guessCuisine } from "@/lib/cuisine";
import { requireAdmin } from "@/utils/supabase/auth-helpers";

// Google Places API (New) — REST endpoint.
// The API key stays server-side; it is never sent to the browser.

const BASE = "https://places.googleapis.com/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpeningHours = {
  openNow: boolean;
  weekdayDescriptions: string[]; // e.g. "Monday: 12:00–2:30 PM, 7:00–10:00 PM"
};

export type PlaceDetails = {
  formattedAddress: string;
  regularOpeningHours: OpeningHours | null;
  photoUris: string[]; // resolved photo CDN URLs (up to 3 — the only call sites, the restaurant detail page and the admin edit panel, both show at most 3)
  phone: string | null;
  website: string | null;
};

export type ResolvedPlace = {
  googlePlaceId: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisine: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string[] | null;
};

// ── Action ────────────────────────────────────────────────────────────────────

export async function getPlaceDetails(
  placeId: string,
  { photosOnly = false }: { photosOnly?: boolean } = {}
): Promise<PlaceDetails> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY env var is not set");

  // `photos` alone is Basic Data (cheapest Places Details SKU);
  // formattedAddress/regularOpeningHours/phone/website are Contact Data,
  // which bumps the *entire* request to the pricier Pro SKU even though
  // only one field needs it. The restaurant detail page (by far the
  // highest-volume caller — one call per public page view) only ever reads
  // photoUris (address/phone/website/hours come from the DB since Roadmap-
  // Schritt 18), so it passes `photosOnly` to stay on the cheap tier. The
  // admin edit panel and the sync actions still need the full field mask to
  // populate/refresh those DB columns.
  const fieldMask = photosOnly
    ? "photos"
    : "formattedAddress,regularOpeningHours,photos,internationalPhoneNumber,websiteUri";

  // Step 1 — fetch place fields (languageCode/regionCode: deutsche Öffnungszeiten-Strings statt englischer)
  const detailRes = await fetch(
    `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=de&regionCode=DE`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      // no-store: hours change daily, photos expire; always fetch fresh
      cache: "no-store",
    }
  );

  if (!detailRes.ok) {
    const msg = await detailRes.text().catch(() => String(detailRes.status));
    throw new Error(`Google Places API error ${detailRes.status}: ${msg}`);
  }

  const place = (await detailRes.json()) as {
    formattedAddress?: string;
    regularOpeningHours?: {
      openNow?: boolean;
      weekdayDescriptions?: string[];
    };
    photos?: Array<{ name: string }>;
    internationalPhoneNumber?: string;
    websiteUri?: string;
  };

  // Step 2 — resolve photo URIs in parallel (max 3 — the only call sites show at most 3)
  const photoNames = (place.photos ?? []).slice(0, 3).map((p) => p.name);

  const photoUris = (
    await Promise.all(
      photoNames.map(async (name) => {
        const res = await fetch(
          `${BASE}/${name}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${apiKey}`,
          { cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { photoUri?: string };
        return data.photoUri ?? null;
      })
    )
  ).filter((u): u is string => u !== null);

  return {
    formattedAddress: place.formattedAddress ?? "",
    regularOpeningHours: place.regularOpeningHours
      ? {
          openNow: place.regularOpeningHours.openNow ?? false,
          weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions ?? [],
        }
      : null,
    photoUris,
    phone: place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
  };
}

// ── CSV-Import: Ort anhand Name (+ evtl. extrahierter Place-ID) auflösen ──────
// Der CSV-Import kennt nur einen Namen und oft keine brauchbare Place-ID (s.
// csvImport.ts — moderne Google-Maps-Share-Links enthalten eine CID statt
// einer Place-ID). Damit importierte Entwürfe trotzdem sofort Kartendaten
// haben, wird hier zuerst die evtl. vorhandene Place-ID direkt aufgelöst und
// bei Fehlschlag per Text-Suche nach dem Namen der wahrscheinlichste Treffer
// verwendet. Nur ein bestmöglicher Vorschlag — der Admin prüft/korrigiert vor
// Veröffentlichung ohnehin über die Places-Autocomplete im Edit-Panel.
export async function resolvePlaceForImport(
  name: string,
  placeId: string | null
): Promise<ResolvedPlace | null> {
  // Only ever meant to run as part of the admin-only CSV import
  // (confirmCsvImport() in csvImport.ts, which already calls requireAdmin()
  // itself) — but every exported function in a "use server" file is its own
  // public HTTP endpoint regardless of who calls it internally, so without
  // its own check any approved-but-non-admin account could invoke this
  // directly to burn the Google Places API quota/budget.
  await requireAdmin();

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY env var is not set");

  // Same field set (location + address + cuisine-guess inputs + contact/
  // opening-hours) for both the direct ID lookup and the text-search
  // fallback below, so the import always comes back with everything we can
  // persist when a place is found — not just lat/lng — mirroring what the
  // admin's manual Google search (PlacesAutocomplete) already fills in, and
  // saving a follow-up getPlaceDetails() call once the admin opens the
  // imported draft to edit it.
  const fields =
    "id,location,formattedAddress,primaryTypeDisplayName,primaryType,types,internationalPhoneNumber,websiteUri,regularOpeningHours";

  if (placeId) {
    // languageCode/regionCode: ohne das liefert Google primaryTypeDisplayName
    // (die Grundlage für den Cuisine-Vorschlag, s. guessCuisine()) auf
    // Englisch statt Deutsch — dieselben Params wie in getPlaceDetails()
    // oben, aus demselben Grund (dort für die Öffnungszeiten-Strings).
    const res = await fetch(
      `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=de&regionCode=DE`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fields,
        },
        cache: "no-store",
      }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        id?: string;
        location?: { latitude: number; longitude: number };
        formattedAddress?: string;
        primaryTypeDisplayName?: { text?: string };
        primaryType?: string;
        types?: string[];
        internationalPhoneNumber?: string;
        websiteUri?: string;
        regularOpeningHours?: { weekdayDescriptions?: string[] };
      };
      if (data.id && data.location) {
        return {
          googlePlaceId: data.id,
          lat: data.location.latitude,
          lng: data.location.longitude,
          address: data.formattedAddress ?? null,
          cuisine: guessCuisine(data.primaryTypeDisplayName?.text, data.primaryType, data.types),
          phone: data.internationalPhoneNumber ?? null,
          website: data.websiteUri ?? null,
          openingHours: data.regularOpeningHours?.weekdayDescriptions ?? null,
        };
      }
    }
    // Fällt durch zur Textsuche, falls die extrahierte ID keine echte Place-ID war.
  }

  const searchRes = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields.split(",").map((f) => `places.${f}`).join(","),
      "Content-Type": "application/json",
    },
    // languageCode/regionCode live in the POST body for this endpoint
    // (unlike the GET lookup above, where they're query params).
    body: JSON.stringify({ textQuery: name, languageCode: "de", regionCode: "DE" }),
    cache: "no-store",
  });
  if (!searchRes.ok) return null;

  const searchData = (await searchRes.json()) as {
    places?: Array<{
      id?: string;
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
      primaryTypeDisplayName?: { text?: string };
      primaryType?: string;
      types?: string[];
      internationalPhoneNumber?: string;
      websiteUri?: string;
      regularOpeningHours?: { weekdayDescriptions?: string[] };
    }>;
  };
  const top = searchData.places?.[0];
  if (top?.id && top.location) {
    return {
      googlePlaceId: top.id,
      lat: top.location.latitude,
      lng: top.location.longitude,
      address: top.formattedAddress ?? null,
      cuisine: guessCuisine(top.primaryTypeDisplayName?.text, top.primaryType, top.types),
      phone: top.internationalPhoneNumber ?? null,
      website: top.websiteUri ?? null,
      openingHours: top.regularOpeningHours?.weekdayDescriptions ?? null,
    };
  }
  return null;
}
