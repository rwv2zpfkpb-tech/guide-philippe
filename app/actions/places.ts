"use server";

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
};

// ── Action ────────────────────────────────────────────────────────────────────

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY env var is not set");

  // Step 1 — fetch place fields (languageCode/regionCode: deutsche Öffnungszeiten-Strings statt englischer)
  const detailRes = await fetch(
    `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=de&regionCode=DE`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "formattedAddress,regularOpeningHours,photos,internationalPhoneNumber,websiteUri",
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
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY env var is not set");

  if (placeId) {
    const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,location",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        id?: string;
        location?: { latitude: number; longitude: number };
      };
      if (data.id && data.location) {
        return { googlePlaceId: data.id, lat: data.location.latitude, lng: data.location.longitude };
      }
    }
    // Fällt durch zur Textsuche, falls die extrahierte ID keine echte Place-ID war.
  }

  const searchRes = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.location",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: name }),
    cache: "no-store",
  });
  if (!searchRes.ok) return null;

  const searchData = (await searchRes.json()) as {
    places?: Array<{ id?: string; location?: { latitude: number; longitude: number } }>;
  };
  const top = searchData.places?.[0];
  if (top?.id && top.location) {
    return { googlePlaceId: top.id, lat: top.location.latitude, lng: top.location.longitude };
  }
  return null;
}
