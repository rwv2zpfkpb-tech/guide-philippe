"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapView } from "@/components/map/MapView";
import { LocationSearch } from "@/components/LocationSearch";
import { PriceLevelDots } from "@/components/PriceLevelDots";
import { SPOON_RATINGS, SPOON_RATING_ORDER } from "@/lib/ratings";
import type { Restaurant } from "@/types/database";
import type { MapRestaurant } from "@/components/map/MapView";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveFilters = {
  price_level?: number;
  spoon_rating?: number;
  cuisine?: string;
};

type LocationParams = {
  location: string;
  lat: string; lng: string;
  ne_lat: string; ne_lng: string;
  sw_lat: string; sw_lng: string;
};

type Props = {
  restaurants:   Restaurant[];
  center:        { lat: number; lng: number };
  locationParams: LocationParams;
  activeFilters: ActiveFilters;
  cuisines:      string[];
};

// ── Compact list card ─────────────────────────────────────────────────────────

function ResultCard({ restaurant, index }: { restaurant: Restaurant; index: number }) {
  const rt = SPOON_RATINGS[restaurant.spoon_rating];

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 76px 1fr auto",
        gap: 12,
        alignItems: "start",
        padding: "14px 24px",
        borderLeft: "3px solid transparent",
        textDecoration: "none",
        transition: "background .18s, border-color .18s",
        borderBottom: "1px solid var(--c-n100)",
      }}
      className="result-card-row"
    >
      {/* Number */}
      <span style={{
        fontFamily: "var(--font-cormorant)", fontSize: "0.875rem",
        fontWeight: 300, color: "var(--c-n300)", paddingTop: 2, letterSpacing: "0.02em",
      }}>
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Thumbnail */}
      <div style={{
        width: 76, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        background: "repeating-linear-gradient(-45deg, var(--c-n100), var(--c-n100) 1px, var(--c-n50) 1px, var(--c-n50) 10px)",
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 9, color: "var(--c-n300)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
          IMG
        </span>
        <div style={{
          position: "absolute", bottom: 4, right: 4,
          background: "var(--c-surface)", borderRadius: 3, padding: "2px 4px",
          fontSize: 10, lineHeight: 1, boxShadow: "var(--s-sm)",
        }}>
          {rt.emoji}
        </div>
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-cormorant)", fontSize: "1.1rem", fontWeight: 600,
          color: "var(--c-ink)", lineHeight: 1.2, marginBottom: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {restaurant.name}
        </div>
        {restaurant.cuisine && (
          <div style={{
            fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.10em",
            textTransform: "uppercase", color: "var(--c-gold)", marginBottom: 4,
          }}>
            {restaurant.cuisine}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ marginBottom: 4, fontSize: "0.8125rem", fontWeight: 500, letterSpacing: "0.02em" }}>
          <PriceLevelDots level={restaurant.price_level} />
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--c-n400)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          {rt.labelShort}
        </div>
      </div>
    </Link>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.02em",
        padding: "6px 12px", borderRadius: 9999,
        border: `1px solid ${active ? "var(--c-burg)" : "var(--c-n200)"}`,
        background: active ? "var(--c-burg)" : "white",
        color: active ? "white" : "var(--c-n600)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all .18s var(--ease)", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PRICE_CHIPS = [
  { value: 1, label: "€" },
  { value: 2, label: "€€" },
  { value: 3, label: "€€€" },
  { value: 4, label: "€€€€" },
];

const SPOON_CHIPS = SPOON_RATING_ORDER.map((value) => ({
  value,
  label: SPOON_RATINGS[value].emoji,
  title: SPOON_RATINGS[value].label,
}));

export function SearchResultsView({
  restaurants, center, locationParams, activeFilters, cuisines,
}: Props) {
  const router = useRouter();

  const mapRestaurants: MapRestaurant[] = restaurants
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id, name: r.name,
      lat: r.lat!, lng: r.lng!,
      spoon_rating: r.spoon_rating,
    }));

  // Build a URL that keeps all location params + updates one filter
  const buildUrl = (overrides: Partial<ActiveFilters & { clear: true }>) => {
    const p = new URLSearchParams(locationParams);
    if ("clear" in overrides) return `/?${p.toString()}`;
    const merged = { ...activeFilters, ...overrides };
    if (merged.cuisine)      p.set("cuisine",      merged.cuisine);
    if (merged.price_level)  p.set("price_level",  String(merged.price_level));
    if (merged.spoon_rating !== undefined) p.set("spoon_rating", String(merged.spoon_rating));
    return `/?${p.toString()}`;
  };

  const togglePrice = (v: number) => {
    if (activeFilters.price_level === v) {
      const p = new URLSearchParams(locationParams);
      if (activeFilters.spoon_rating !== undefined) p.set("spoon_rating", String(activeFilters.spoon_rating));
      if (activeFilters.cuisine)                    p.set("cuisine",      activeFilters.cuisine);
      router.push(`/?${p.toString()}`);
    } else {
      router.push(buildUrl({ price_level: v }));
    }
  };

  const toggleSpoon = (v: number) => {
    if (activeFilters.spoon_rating === v) {
      const p = new URLSearchParams(locationParams);
      if (activeFilters.price_level) p.set("price_level", String(activeFilters.price_level));
      if (activeFilters.cuisine)     p.set("cuisine",     activeFilters.cuisine);
      router.push(`/?${p.toString()}`);
    } else {
      router.push(buildUrl({ spoon_rating: v }));
    }
  };

  const toggleCuisine = (v: string) => {
    if (activeFilters.cuisine === v) {
      const p = new URLSearchParams(locationParams);
      if (activeFilters.price_level)               p.set("price_level",  String(activeFilters.price_level));
      if (activeFilters.spoon_rating !== undefined) p.set("spoon_rating", String(activeFilters.spoon_rating));
      router.push(`/?${p.toString()}`);
    } else {
      router.push(buildUrl({ cuisine: v }));
    }
  };

  const hasActiveFilters =
    activeFilters.price_level !== undefined ||
    activeFilters.spoon_rating !== undefined ||
    activeFilters.cuisine;

  return (
    <>
      {/* Inject hover style for result cards */}
      <style>{`
        .result-card-row:hover {
          background: var(--c-n50);
          border-left-color: var(--c-gold) !important;
        }
      `}</style>

      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div style={{
          width: 420, flexShrink: 0, display: "flex", flexDirection: "column",
          borderRight: "1px solid var(--c-n100)", height: "100%",
        }}>

          {/* Search bar strip */}
          <div style={{
            padding: "10px 20px", borderBottom: "1px solid var(--c-n100)",
            background: "var(--c-bg)", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <LocationSearch defaultValue={locationParams.location} size="compact" />
            </div>
            <button
              onClick={() => router.push("/")}
              style={{
                fontSize: "0.8125rem", color: "var(--c-n400)", background: "none",
                border: "none", cursor: "pointer", padding: "4px 2px",
                fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Query bar: count + location */}
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            padding: "14px 24px 10px", borderBottom: "1px solid var(--c-n100)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{
                fontFamily: "var(--font-cormorant)", fontSize: "1.5rem",
                fontWeight: 600, color: "var(--c-ink)",
              }}>
                {restaurants.length}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--c-n400)", letterSpacing: "0.04em" }}>
                Ergebnisse für
              </span>
              <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--c-ink)" }}>
                „{locationParams.location}&rdquo;
              </span>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{
            padding: "12px 24px", borderBottom: "1px solid var(--c-n100)",
            flexShrink: 0, display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* Cuisine row */}
            {cuisines.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--c-n400)", whiteSpace: "nowrap",
                }}>
                  Küche
                </span>
                {cuisines.map((c) => (
                  <Chip
                    key={c} label={c}
                    active={activeFilters.cuisine === c}
                    onClick={() => toggleCuisine(c)}
                  />
                ))}
              </div>
            )}

            {/* Price + Rating row */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--c-n400)",
                }}>
                  Preis
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  {PRICE_CHIPS.map((p) => (
                    <Chip
                      key={p.value} label={p.label}
                      active={activeFilters.price_level === p.value}
                      onClick={() => togglePrice(p.value)}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--c-n400)",
                }}>
                  Bewertung
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  {SPOON_CHIPS.map((s) => (
                    <Chip
                      key={s.value} label={s.label}
                      active={activeFilters.spoon_rating === s.value}
                      onClick={() => toggleSpoon(s.value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <button
                onClick={() => router.push(`/?${new URLSearchParams(locationParams).toString()}`)}
                style={{
                  alignSelf: "flex-start", fontSize: "0.75rem", fontWeight: 500,
                  color: "var(--c-burg)", background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.03em", padding: 0,
                }}
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          {/* Results list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {restaurants.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "60px 24px", gap: 14, textAlign: "center",
              }}>
                <div style={{ fontSize: "2rem" }}>🫗</div>
                <p style={{ fontSize: "0.875rem", color: "var(--c-n500)" }}>
                  Keine Restaurants gefunden.
                </p>
                <button
                  onClick={() => router.push(`/?${new URLSearchParams(locationParams).toString()}`)}
                  style={{
                    fontSize: "0.8125rem", fontWeight: 500, padding: "8px 20px",
                    borderRadius: 8, border: "1px solid var(--c-n200)",
                    background: "var(--c-surface)", color: "var(--c-ink)", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Filter löschen
                </button>
              </div>
            ) : (
              restaurants.map((r, i) => (
                <ResultCard key={r.id} restaurant={r} index={i} />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL (MAP) ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapView
            restaurants={mapRestaurants}
            center={center}
            zoom={11}
            className="w-full h-full"
          />
        </div>
      </div>
    </>
  );
}
