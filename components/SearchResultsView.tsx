"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapView } from "@/components/map/MapView";
import { LocationSearch } from "@/components/LocationSearch";
import { PriceLevelDots } from "@/components/PriceLevelDots";
import { NavigateButton } from "@/components/NavigateButton";
import { getPlaceDetails, type OpeningHours } from "@/app/actions/places";
import { IconEmptyState, IconMap, IconList, IconChevronDown, IconClock } from "@/components/icons";
import { SPOON_RATINGS, SPOON_RATING_COLORS, SPOON_RATING_ORDER } from "@/lib/ratings";
import type { Restaurant } from "@/types/database";
import type { MapRestaurant } from "@/components/map/MapView";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveFilters = {
  price_level: number[];
  spoon_rating: number[];
  cuisine: string[];
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
// No thumbnail — restaurant photos only appear on the detail page. The spoon
// rating is instead color-coded (SPOON_RATING_COLORS) in the meta column.
// Clicking the row expands it in place (rather than navigating away) to show
// live opening hours + two explicit actions — going to the full detail page
// and starting turn-by-turn navigation are separate, deliberate choices.

function ResultCard({ restaurant, index }: { restaurant: Restaurant; index: number }) {
  const rt = SPOON_RATINGS[restaurant.spoon_rating];
  const colors = SPOON_RATING_COLORS[restaurant.spoon_rating];
  const [expanded, setExpanded] = useState(false);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursFetched, setHoursFetched] = useState(false);
  const [hours, setHours] = useState<OpeningHours | null>(null);

  // Lazy-fetch opening hours only once actually expanded — avoids firing a
  // Places API call per row for the entire results list up front.
  useEffect(() => {
    if (!expanded || hoursFetched || !restaurant.google_place_id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoursLoading(true);
    getPlaceDetails(restaurant.google_place_id)
      .then((details) => {
        if (!cancelled) setHours(details.regularOpeningHours);
      })
      .catch(() => {
        if (!cancelled) setHours(null);
      })
      .finally(() => {
        if (!cancelled) {
          setHoursLoading(false);
          setHoursFetched(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, hoursFetched, restaurant.google_place_id]);

  return (
    <div style={{ borderBottom: "1px solid var(--c-n100)" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr auto 18px",
          gap: 12,
          alignItems: "center",
          width: "100%",
          padding: "14px 24px",
          borderLeft: "3px solid transparent",
          border: "none",
          background: "none",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background .18s, border-color .18s",
        }}
        className="result-card-row"
      >
        {/* Number */}
        <span style={{
          fontFamily: "var(--font-cormorant)", fontSize: "0.875rem",
          fontWeight: 300, color: "var(--c-n300)", letterSpacing: "0.02em",
        }}>
          {String(index + 1).padStart(2, "0")}
        </span>

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
              textTransform: "uppercase", color: "var(--c-gold)",
            }}>
              {restaurant.cuisine}
            </div>
          )}
        </div>

        {/* Meta */}
        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", fontWeight: 500, letterSpacing: "0.02em" }}>
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>{rt.emoji}</span>
            <PriceLevelDots level={restaurant.price_level} />
          </div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: colors.text, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {rt.labelShort}
          </div>
        </div>

        {/* Expand indicator */}
        <span style={{ color: "var(--c-n300)", display: "flex", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .18s" }}>
          <IconChevronDown size={14} />
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 24px 18px 60px" }}>
          {/* Opening hours */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.8125rem", color: "var(--c-n500)", marginBottom: 14 }}>
            <IconClock size={14} className="text-[var(--c-n400)]" />
            {!restaurant.google_place_id ? (
              <span>Keine Öffnungszeiten verfügbar</span>
            ) : hoursLoading ? (
              <span>Lädt…</span>
            ) : hours ? (
              <span style={{ color: hours.openNow ? "var(--c-success)" : "var(--c-burg)", fontWeight: 500 }}>
                {hours.openNow ? "Jetzt geöffnet" : "Geschlossen"}
              </span>
            ) : (
              <span>Keine Öffnungszeiten verfügbar</span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/restaurant/${restaurant.id}`}
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: "0.8125rem", fontWeight: 500,
                padding: "10px 18px", borderRadius: 9999,
                border: "1px solid var(--c-n200)", color: "var(--c-ink)",
                background: "var(--c-surface)", textDecoration: "none",
              }}
            >
              Zur Restaurant-Seite
            </Link>
            {restaurant.lat != null && restaurant.lng != null && (
              <NavigateButton
                name={restaurant.name}
                lat={restaurant.lat}
                lng={restaurant.lng}
                googlePlaceId={restaurant.google_place_id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────
// Uses var(--c-surface) rather than a literal "white" for the inactive state —
// hardcoded white stayed bright in dark mode and read as too light/low-contrast.

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={active ? "filter-chip is-active" : "filter-chip"}
      style={{
        fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.02em",
        padding: "6px 12px", borderRadius: 9999,
        border: `1px solid ${active ? "var(--c-burg)" : "var(--c-n200)"}`,
        background: active ? "var(--c-burg)" : "var(--c-surface)",
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
  { value: 0, label: "Kostenlos" },
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

function sameFilters(a: ActiveFilters, b: ActiveFilters): boolean {
  const eq = (x: number[] | string[], y: number[] | string[]) =>
    x.length === y.length && x.every((v) => (y as (number | string)[]).includes(v));
  return eq(a.cuisine, b.cuisine) && eq(a.price_level, b.price_level) && eq(a.spoon_rating, b.spoon_rating);
}

// Wrapper keys the actual view by the applied filters so the staged
// "pending" filter state below resets on navigation (new search params)
// without needing an effect to sync it back — React remounts a fresh
// instance whenever the key changes instead.
export function SearchResultsView(props: Props) {
  const filterKey = JSON.stringify(props.activeFilters);
  return <SearchResultsViewInner key={filterKey} {...props} />;
}

function SearchResultsViewInner({
  restaurants, center, locationParams, activeFilters, cuisines,
}: Props) {
  const router = useRouter();

  // Filter chip clicks are staged locally and only take effect once
  // "Übernehmen" is pressed — avoids a full re-navigation per click.
  const [pending, setPending] = useState<ActiveFilters>(activeFilters);

  // Mobile-only list/map toggle. Both panels stay mounted side-by-side in a
  // double-width viewport; toggling just translates it left/right so it
  // reads as the same "map next to list" layout the viewport pans across,
  // rather than a hard swap. Desktop CSS neutralizes the transform entirely.
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const mapRestaurants: MapRestaurant[] = restaurants
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id, name: r.name,
      lat: r.lat!, lng: r.lng!,
      spoon_rating: r.spoon_rating,
    }));

  // Build a URL that keeps all location params + applies the given filters
  const buildUrl = (filters: ActiveFilters) => {
    const p = new URLSearchParams(locationParams);
    filters.cuisine.forEach((c) => p.append("cuisine", c));
    filters.price_level.forEach((v) => p.append("price_level", String(v)));
    filters.spoon_rating.forEach((v) => p.append("spoon_rating", String(v)));
    return `/?${p.toString()}`;
  };

  const togglePrice = (v: number) => {
    setPending((f) => ({
      ...f,
      price_level: f.price_level.includes(v) ? f.price_level.filter((x) => x !== v) : [...f.price_level, v],
    }));
  };

  const toggleSpoon = (v: number) => {
    setPending((f) => ({
      ...f,
      spoon_rating: f.spoon_rating.includes(v) ? f.spoon_rating.filter((x) => x !== v) : [...f.spoon_rating, v],
    }));
  };

  const toggleCuisine = (v: string) => {
    setPending((f) => ({
      ...f,
      cuisine: f.cuisine.includes(v) ? f.cuisine.filter((x) => x !== v) : [...f.cuisine, v],
    }));
  };

  const applyFilters = () => router.push(buildUrl(pending));
  const resetFilters = () => {
    const empty = { cuisine: [], price_level: [], spoon_rating: [] };
    setPending(empty);
    router.push(buildUrl(empty));
  };

  const hasPendingFilters =
    pending.price_level.length > 0 || pending.spoon_rating.length > 0 || pending.cuisine.length > 0;
  const filtersDirty = !sameFilters(pending, activeFilters);

  return (
    <>
      {/* Inject hover style for result cards */}
      <style>{`
        .result-card-row:hover {
          background: var(--c-n50);
          border-left-color: var(--c-gold) !important;
        }
      `}</style>

      <div className="sr-outer" style={{ height: "calc(100vh - 64px)", overflow: "hidden", position: "relative" }}>
        <div className={`sr-viewport${mobileView === "map" ? " show-map" : ""}`}>

          {/* ── LIST PANEL ───────────────────────────────────────────────── */}
          <div className="sr-list-panel" style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--c-n100)", height: "100%" }}>

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
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
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
                      active={pending.cuisine.includes(c)}
                      onClick={() => toggleCuisine(c)}
                    />
                  ))}
                </div>
              )}

              {/* Price row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--c-n400)", whiteSpace: "nowrap",
                }}>
                  Preis
                </span>
                {PRICE_CHIPS.map((p) => (
                  <Chip
                    key={p.value} label={p.label}
                    active={pending.price_level.includes(p.value)}
                    onClick={() => togglePrice(p.value)}
                  />
                ))}
              </div>

              {/* Rating row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--c-n400)", whiteSpace: "nowrap",
                }}>
                  Bewertung
                </span>
                {SPOON_CHIPS.map((s) => (
                  <Chip
                    key={s.value} label={s.label}
                    active={pending.spoon_rating.includes(s.value)}
                    onClick={() => toggleSpoon(s.value)}
                  />
                ))}
              </div>

              {/* Apply / reset — filter chip changes are staged until "Übernehmen" is pressed */}
              {(filtersDirty || hasPendingFilters) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  {hasPendingFilters ? (
                    <button
                      onClick={resetFilters}
                      style={{
                        fontSize: "0.75rem", fontWeight: 500,
                        color: "var(--c-burg)", background: "none", border: "none",
                        cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.03em", padding: 0,
                      }}
                    >
                      Filter zurücksetzen
                    </button>
                  ) : <span />}
                  {filtersDirty && (
                    <button
                      onClick={applyFilters}
                      style={{
                        fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.02em",
                        color: "white", background: "var(--c-burg)", border: "none",
                        borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Übernehmen
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Results list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {restaurants.length === 0 ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", padding: "60px 24px", gap: 14, textAlign: "center",
                }}>
                  <IconEmptyState size={32} className="text-[var(--c-n400)]" />
                  <p style={{ fontSize: "0.875rem", color: "var(--c-n500)" }}>
                    Keine Restaurants gefunden.
                  </p>
                  <button
                    onClick={resetFilters}
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

          {/* ── MAP PANEL ────────────────────────────────────────────────── */}
          <div className="sr-map-panel" style={{ position: "relative", overflow: "hidden", height: "100%" }}>
            <MapView
              restaurants={mapRestaurants}
              center={center}
              zoom={11}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Mobile-only list/map toggle */}
        <button
          className="sr-mobile-toggle"
          onClick={() => setMobileView((v) => (v === "list" ? "map" : "list"))}
        >
          {mobileView === "list" ? <IconMap size={15} /> : <IconList size={15} />}
          {mobileView === "list" ? "Karte anzeigen" : "Liste anzeigen"}
        </button>
      </div>
    </>
  );
}
