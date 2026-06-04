import { Suspense } from "react";
import { getRestaurants } from "@/app/actions/restaurants";
import RestaurantCard from "@/components/RestaurantCard";
import FilterBar from "@/components/FilterBar";
import type { RestaurantFilters } from "@/app/actions/restaurants";
import type { PriceLevel, SpoonRating } from "@/types/database";

export const metadata = { title: "Guide Philippe" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cuisine?: string; price_level?: string; spoon_rating?: string }>;
}) {
  const params = await searchParams;

  const filters: RestaurantFilters = {};
  if (params.cuisine) filters.cuisine = params.cuisine;
  if (params.price_level) filters.price_level = Number(params.price_level) as PriceLevel;
  if (params.spoon_rating !== undefined && params.spoon_rating !== "") {
    filters.spoon_rating = Number(params.spoon_rating) as SpoonRating;
  }

  const restaurants = await getRestaurants(filters);
  const cuisines = Array.from(
    new Set(restaurants.map((r) => r.cuisine).filter(Boolean) as string[])
  ).sort();

  const hasFilters = params.cuisine || params.price_level || params.spoon_rating !== undefined;

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "72px 40px 68px",
          textAlign: "center",
          background: `linear-gradient(175deg,
            oklch(90% 0.024 17) 0%,
            oklch(95% 0.014 17) 38%,
            var(--c-bg) 100%)`,
        }}
      >
        {/* Watermark */}
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
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          GP
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
              marginBottom: 44,
              animation: "fadeUp 0.8s var(--ease) 0.25s both",
            }}
          >
            An honest, curated guide to exceptional dining.
          </p>

          {/* Filter chips */}
          <div
            style={{
              animation: "fadeUp 0.8s var(--ease) 0.45s both",
            }}
          >
            <Suspense>
              <FilterBar cuisines={cuisines} />
            </Suspense>
          </div>
        </div>
      </section>

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
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
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
              {hasFilters ? "Suchergebnisse" : "Restaurants"}
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
            {hasFilters ? "Gefilterte Auswahl" : "Unsere Auswahl"}
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
    </>
  );
}
