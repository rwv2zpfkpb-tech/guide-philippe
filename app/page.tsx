import {
  getRestaurants,
  getCuisines,
  getRecentRestaurants,
  getFeaturedRestaurants,
} from "@/app/actions/restaurants";
import RestaurantCard from "@/components/RestaurantCard";
import { HeroSearch } from "@/components/HeroSearch";
import { SearchResultsView } from "@/components/SearchResultsView";
import { InstallPwaInstructions } from "@/components/InstallPwaInstructions";
import { HorizontalScrollRow } from "@/components/HorizontalScrollRow";
import type { RestaurantFilters } from "@/app/actions/restaurants";
import type { PriceLevel, SpoonRating } from "@/types/database";
import { haversineDistanceKm, MAX_SEARCH_RADIUS_KM } from "@/lib/geo";

export const metadata = { title: "Guide Philippe" };

type SearchParams = {
  q?: string;
  cuisine?: string | string[];
  price_level?: string | string[];
  spoon_rating?: string | string[];
  location?: string;
  lat?: string;
  lng?: string;
  ne_lat?: string;
  ne_lng?: string;
  sw_lat?: string;
  sw_lng?: string;
  own_location?: string;
};

function toArray(v?: string | string[]): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const isLocationSearch = !!(
    params.lat && params.lng &&
    params.ne_lat && params.ne_lng &&
    params.sw_lat && params.sw_lng
  );

  const cuisineFilters = toArray(params.cuisine);
  const priceLevelFilters = toArray(params.price_level).map(Number) as PriceLevel[];
  const spoonRatingFilters = toArray(params.spoon_rating).map(Number) as SpoonRating[];

  const filters: RestaurantFilters = {};
  if (params.q) filters.name_search = params.q;
  if (cuisineFilters.length) filters.cuisine = cuisineFilters;
  if (priceLevelFilters.length) filters.price_level = priceLevelFilters;
  if (spoonRatingFilters.length) filters.spoon_rating = spoonRatingFilters;
  // A location search (typed/selected place or "Standort verwenden") never
  // uses Google's per-place viewport as a DB bounds filter — that size
  // varies wildly by place type (city-sized for "Berlin" vs. a few hundred
  // meters for a single street address like "Sächsische Straße") and
  // unpredictably dropped curated restaurants that were obviously still
  // "in the area". Instead a fixed straight-line radius cutoff is applied
  // below, once the search center is known (s. MAX_SEARCH_RADIUS_KM,
  // Roadmap-Schritt 15/16/17).

  // Facet base: the same location's restaurants but WITHOUT the
  // cuisine/price/spoon_rating filters applied (only the name search, if
  // any) — needed so the filter chips/dropdown in SearchResultsView can
  // show "how many restaurants match this option" counts that don't
  // collapse to zero once a sibling category is already filtered down.
  // Only fetched for the location-search branch below; a second DB round
  // trip is fine here (small curated dataset, same reasoning already
  // documented for the unbounded per-location restaurant fetch, s.
  // Roadmap-Schritt 16/17).
  const facetFilters: RestaurantFilters = {};
  if (params.q) facetFilters.name_search = params.q;

  const [restaurants, cuisines, facetRestaurants] = await Promise.all([
    getRestaurants(filters),
    getCuisines(),
    isLocationSearch ? getRestaurants(facetFilters) : Promise.resolve([]),
  ]);

  // ── Location search mode: split list + map ────────────────────────────────
  if (isLocationSearch) {
    const center = { lat: Number(params.lat), lng: Number(params.lng) };
    // Straight-line-distance cutoff, not a Google-viewport-derived bbox (s.
    // lib/geo.ts) — keeps a search for one city from pulling in restaurants
    // from a completely different one, without the bug where a narrow
    // per-place viewport (e.g. a single street) excluded restaurants that
    // were obviously still in the same city (Roadmap-Schritt 16/17).
    // Restaurants without coordinates can't be distance-checked, so they're
    // excluded from location search results (same as the old bounds filter).
    const withinRadius = (list: typeof restaurants) =>
      list.filter(
        (r) =>
          r.lat != null && r.lng != null &&
          haversineDistanceKm(center, { lat: r.lat, lng: r.lng }) <= MAX_SEARCH_RADIUS_KM
      );
    const nearbyRestaurants = withinRadius(restaurants);
    const allNearbyRestaurants = withinRadius(facetRestaurants);
    const locationParams = {
      location: params.location ?? "",
      lat:    params.lat!,    lng:    params.lng!,
      ne_lat: params.ne_lat!, ne_lng: params.ne_lng!,
      sw_lat: params.sw_lat!, sw_lng: params.sw_lng!,
    };
    return (
      <SearchResultsView
        restaurants={nearbyRestaurants}
        allRestaurants={allNearbyRestaurants}
        center={center}
        locationParams={locationParams}
        activeFilters={{
          price_level:  priceLevelFilters,
          spoon_rating: spoonRatingFilters,
          cuisine:      cuisineFilters,
        }}
        ownLocation={params.own_location === "1"}
      />
    );
  }

  // ── Normal mode: hero + grid ──────────────────────────────────────────────
  const hasFilters = !!(
    params.q || cuisineFilters.length || priceLevelFilters.length || spoonRatingFilters.length
  );
  const restaurantHints = restaurants.map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine }));
  const [recentRestaurants, featuredRestaurants] = await Promise.all([
    getRecentRestaurants(),
    getFeaturedRestaurants(),
  ]);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          // overflow intentionally NOT set here — it would clip the search dropdown.
          // The watermark uses its own clipping wrapper below.
          padding: "72px 40px 68px",
          textAlign: "center",
          background: `linear-gradient(175deg,
            var(--hero-from) 0%,
            var(--hero-mid)  38%,
            var(--c-bg)      100%)`,
        }}
      >
        {/* Watermark clipping wrapper — isolates overflow:hidden so the dropdown is not clipped */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              transform: "translate(-50%, -50%)",
              fontFamily: "var(--font-cormorant)",
              fontSize: "38vw",
              fontWeight: 700,
              letterSpacing: "-0.05em",
              lineHeight: 1,
              color: "oklch(31% 0.080 17 / 0.055)",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            GP
          </div>
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          {/* Brand headline */}
          <h1
            style={{
              fontFamily: "var(--font-cormorant)",
              fontWeight: 700,
              lineHeight: 0.86,
              letterSpacing: "-0.04em",
              marginBottom: 22,
              animation: "fadeUp 0.85s var(--ease) 0.05s both",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "clamp(3rem, 6vw, 5.2rem)",
                fontWeight: 300,
                color: "var(--c-n600)",
                letterSpacing: "-0.02em",
              }}
            >
              Guide
            </span>
            <span
              style={{
                display: "block",
                fontSize: "clamp(5.5rem, 12vw, 10.5rem)",
                color: "var(--c-burg)",
                lineHeight: 0.82,
                paddingBottom: "0.09em",
              }}
            >
              Philippe
            </span>
          </h1>

          <p
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.15rem",
              fontWeight: 300,
              fontStyle: "italic",
              color: "oklch(38% 0.040 17)",
              marginBottom: 36,
              animation: "fadeUp 0.8s var(--ease) 0.25s both",
            }}
          >
            An honest, curated guide to exceptional dining.
          </p>

          {/* Location search + filter chips: filters are staged locally and only
              take effect once "Suchen" is pressed (see HeroSearch) */}
          <HeroSearch cuisines={cuisines} restaurantHints={restaurantHints} />
        </div>
      </section>

      {/* ── AUSWAHL (redaktionell kuratiert, admin-gepflegt) ── */}
      {featuredRestaurants.length > 0 && (
        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 40px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <h2
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "1.5rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--c-ink)",
              }}
            >
              Auswahl
            </h2>
            <span style={{ fontSize: 11, color: "var(--c-n400)", letterSpacing: "0.06em" }}>
              Handverlesen von der Redaktion
            </span>
          </div>
          <HorizontalScrollRow>
            {featuredRestaurants.map((r) => (
              <div key={r.id} style={{ minWidth: 230, maxWidth: 230, flexShrink: 0 }}>
                <RestaurantCard restaurant={r} />
              </div>
            ))}
          </HorizontalScrollRow>
        </section>
      )}

      {/* ── RECENTLY ADDED (last 30 days) ─────────────────── */}
      {recentRestaurants.length > 0 && (
        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 40px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <h2
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "1.5rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--c-ink)",
              }}
            >
              Neu hinzugefügt
            </h2>
            <span style={{ fontSize: 11, color: "var(--c-n400)", letterSpacing: "0.06em" }}>
              Die neuesten Einträge
            </span>
          </div>
          <HorizontalScrollRow>
            {recentRestaurants.map((r) => (
              <div key={r.id} style={{ minWidth: 230, maxWidth: 230, flexShrink: 0 }}>
                <RestaurantCard restaurant={r} />
              </div>
            ))}
          </HorizontalScrollRow>
        </section>
      )}

      {/* ── RESTAURANT GRID ───────────────────────────────
          Only rendered for an actual search/filter — the unfiltered full
          restaurant list (hundreds of entries) used to render here by
          default, which was overwhelming on a landing page that already
          has "Auswahl"/"Neu hinzugefügt" for browsing plus the hero search
          for finding something specific. */}
      {hasFilters && (
        <main
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "56px 40px 80px",
            flex: 1,
          }}
        >
          {/* Section head */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "2rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                lineHeight: 1,
                color: "var(--c-ink)",
              }}
            >
              {params.q ? `Ergebnisse für „${params.q}"` : "Suchergebnisse"}
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--c-burg)",
              }}
            >
              {restaurants.length} {restaurants.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          </div>

          {/* Ornament */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 36,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--c-n100)" }} />
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--c-gold)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "0.875rem",
                fontStyle: "italic",
                color: "var(--c-n400)",
                whiteSpace: "nowrap",
                letterSpacing: "0.04em",
              }}
            >
              {params.q ? "Namenssuche" : "Gefilterte Auswahl"}
            </span>
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--c-gold)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, height: 1, background: "var(--c-n100)" }} />
          </div>

          {restaurants.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 0",
                color: "var(--c-n400)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 16 }}>🫗</div>
              <p
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "1.5rem",
                  fontWeight: 500,
                  color: "var(--c-n500)",
                  marginBottom: 8,
                }}
              >
                Keine Restaurants gefunden.
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--c-n400)" }}>
                Versuche einen anderen Filter oder füge Restaurants im Admin-Bereich hinzu.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
              className="restaurant-grid"
            >
              {restaurants.map((r) => (
                <RestaurantCard key={r.id} restaurant={r} />
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── PWA INSTALL INSTRUCTIONS ────────────────────── */}
      <InstallPwaInstructions />
    </>
  );
}
