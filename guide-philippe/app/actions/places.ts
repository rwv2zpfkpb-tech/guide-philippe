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
  photoUris: string[]; // resolved photo CDN URLs (up to 5)
};

// ── Action ────────────────────────────────────────────────────────────────────

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY env var is not set");

  // Step 1 — fetch place fields
  const detailRes = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "formattedAddress,regularOpeningHours,photos",
    },
    // no-store: hours change daily, photos expire; always fetch fresh
    cache: "no-store",
  });

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
  };

  // Step 2 — resolve photo URIs in parallel (max 5)
  const photoNames = (place.photos ?? []).slice(0, 5).map((p) => p.name);

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
  };
}
