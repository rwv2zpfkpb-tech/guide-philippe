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
import type { RestaurantFilters } from "@/app/actions/restaurants";
import type { PriceLevel, SpoonRating } from "@/types/database";

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
  if (isLocationSearch) {
    filters.bounds = {
      sw_lat: Number(params.sw_lat),
      sw_lng: Number(params.sw_lng),
      ne_lat: Number(params.ne_lat),
      ne_lng: Number(params.ne_lng),
    };
  }

  const [restaurants, cuisines] = await Promise.all([
    getRestaurants(filters),
    getCuisines(),
  ]);

  // ── Location search mode: split list + map ────────────────────────────────
  if (isLocationSearch) {
    const locationParams = {
      location: params.location ?? "",
      lat:    params.lat!,    lng:    params.lng!,
      ne_lat: params.ne_lat!, ne_lng: params.ne_lng!,
      sw_lat: params.sw_lat!, sw_lng: params.sw_lng!,
    };
    return (
      <SearchResultsView
        restaurants={restaurants}
        center={{ lat: Number(params.lat), lng: Number(params.lng) }}
        locationParams={locationParams}
        activeFilters={{
          price_level:  priceLevelFilters,
          spoon_rating: spoonRatingFilters,
          cuisine:      cuisineFilters,
        }}
        cuisines={cuisines}
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
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
            {featuredRestaurants.map((r) => (
              <div key={r.id} style={{ minWidth: 230, maxWidth: 230, flexShrink: 0 }}>
                <RestaurantCard restaurant={r} />
              </div>
            ))}
          </div>
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
              Letzte 30 Tage
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
            {recentRestaurants.map((r) => (
              <div key={r.id} style={{ minWidth: 230, maxWidth: 230, flexShrink: 0 }}>
                <RestaurantCard restaurant={r} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RESTAURANT GRID ─────────────────────────────── */}
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
            {params.q
              ? `Ergebnisse für „${params.q}"`
              : hasFilters ? "Suchergebnisse" : "Restaurants"}
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
            {params.q ? "Namenssuche" : hasFilters ? "Gefilterte Auswahl" : "Unsere Auswahl"}
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

      {/* ── PWA INSTALL INSTRUCTIONS ────────────────────── */}
      <InstallPwaInstructions />
    </>
  );
}
