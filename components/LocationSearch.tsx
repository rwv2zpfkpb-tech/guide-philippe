"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useRouter } from "next/navigation";
import { IconList } from "@/components/icons";

export type RestaurantHint = { id: string; name: string; cuisine: string | null };

export type SearchFilters = {
  cuisine: string[];
  price_level: number[];
  spoon_rating: number[];
};

type Prediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

// Large variant: picking a suggestion only fills the field — it's remembered
// here and only resolved/navigated-to once the user explicitly presses "Suchen".
type PendingSelection =
  | { type: "place"; placeId: string; text: string }
  | { type: "restaurant"; name: string };

type Props = {
  defaultValue?: string;
  size?: "large" | "compact";
  restaurants?: RestaurantHint[];
  filters?: SearchFilters;
};

function appendFilters(p: URLSearchParams, filters: SearchFilters) {
  filters.cuisine.forEach((c) => p.append("cuisine", c));
  filters.price_level.forEach((v) => p.append("price_level", String(v)));
  filters.spoon_rating.forEach((v) => p.append("spoon_rating", String(v)));
}

function navigateToLocation(
  router: ReturnType<typeof useRouter>,
  lat: number,
  lng: number,
  name: string,
  viewport: google.maps.LatLngBounds | null | undefined,
  filters: SearchFilters
) {
  const p = new URLSearchParams({
    location: name,
    lat:    String(lat),
    lng:    String(lng),
    ne_lat: String(viewport ? viewport.getNorthEast().lat() : lat + 0.5),
    ne_lng: String(viewport ? viewport.getNorthEast().lng() : lng + 0.5),
    sw_lat: String(viewport ? viewport.getSouthWest().lat() : lat - 0.5),
    sw_lng: String(viewport ? viewport.getSouthWest().lng() : lng - 0.5),
  });
  appendFilters(p, filters);
  router.push(`/?${p.toString()}`);
}

const NO_PREDICTIONS: Prediction[] = [];
const NO_RESTAURANT_MATCHES: RestaurantHint[] = [];
const NO_FILTERS: SearchFilters = { cuisine: [], price_level: [], spoon_rating: [] };

function LocationSearchInput({ defaultValue = "", size = "large", restaurants = [], filters = NO_FILTERS }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [rawPredictions, setRawPredictions] = useState<Prediction[]>([]);
  // Derived rather than cleared via setState in the effect below — avoids a
  // render-then-clear cascade when the input drops back under 2 characters.
  const predictions = value.length >= 2 ? rawPredictions : NO_PREDICTIONS;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placesLib = useMapsLibrary("places");
  const router    = useRouter();
  const isCompact = size === "compact";

  const restaurantMatches = useMemo(
    () =>
      value.length >= 2
        ? restaurants
            .filter((r) => r.name.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 4)
        : NO_RESTAURANT_MATCHES,
    [value, restaurants]
  );

  // Debounced location predictions using AutocompleteSuggestion (new Places API)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!placesLib || value.length < 2) return;

    debounceRef.current = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { suggestions } = await (google.maps.places as any).AutocompleteSuggestion
          .fetchAutocompleteSuggestions({ input: value, includedPrimaryTypes: ["geocode"] });
        setRawPredictions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (suggestions as any[])
            .filter((s) => s.placePrediction)
            .slice(0, 4)
            .map((s) => ({
              placeId:       s.placePrediction.placeId,
              mainText:      s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? "",
              secondaryText: s.placePrediction.secondaryText?.text ?? "",
            }))
        );
      } catch {
        setRawPredictions([]);
      }
    }, 220);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, placesLib]);

  const totalItems   = restaurantMatches.length + predictions.length;
  const showDropdown = open && totalItems > 0 && value.length >= 2;

  const resolvePlace = useCallback(
    async (placeId: string, fallbackName: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const place = new (google.maps.places as any).Place({ id: placeId });
        await place.fetchFields({ fields: ["location", "formattedAddress", "viewport"] });
        if (!place.location) return;
        navigateToLocation(
          router,
          place.location.lat(),
          place.location.lng(),
          place.formattedAddress ?? fallbackName,
          place.viewport,
          filters
        );
      } catch {
        // fallback: geocode by text
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: fallbackName }, (results, status) => {
          if (status !== "OK" || !results?.[0]) return;
          const loc = results[0].geometry.location;
          navigateToLocation(router, loc.lat(), loc.lng(), results[0].formatted_address, results[0].geometry.viewport, filters);
        });
      }
    },
    [router, filters]
  );

  const submitText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      // If we have location predictions, use the first one
      if (predictions.length > 0) {
        resolvePlace(predictions[0].placeId, predictions[0].mainText);
        return;
      }
      // Fallback: geocode directly
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: text }, (results, status) => {
        if (status !== "OK" || !results?.[0]) return;
        const loc = results[0].geometry.location;
        navigateToLocation(
          router,
          loc.lat(), loc.lng(),
          results[0].formatted_address,
          results[0].geometry.viewport,
          filters
        );
      });
    },
    [predictions, resolvePlace, router, filters]
  );

  // Large variant: selecting a suggestion only fills the field + remembers the
  // pick — navigation happens exclusively via handleSearch ("Suchen" click).
  // Compact variant (no visible button, used for in-map refinement) keeps the
  // previous immediate-navigate behavior.
  const selectItem = useCallback(
    (index: number) => {
      setOpen(false);
      if (index < restaurantMatches.length) {
        const name = restaurantMatches[index].name;
        if (isCompact) {
          router.push(`/?q=${encodeURIComponent(name)}`);
        } else {
          setValue(name);
          setPendingSelection({ type: "restaurant", name });
        }
      } else {
        const pred = predictions[index - restaurantMatches.length];
        if (isCompact) {
          resolvePlace(pred.placeId, pred.mainText);
        } else {
          setValue(pred.mainText);
          setPendingSelection({ type: "place", placeId: pred.placeId, text: pred.mainText });
        }
      }
    },
    [restaurantMatches, predictions, resolvePlace, router, isCompact]
  );

  const handleSearch = useCallback(() => {
    if (pendingSelection?.type === "restaurant") {
      const p = new URLSearchParams({ q: pendingSelection.name });
      appendFilters(p, filters);
      router.push(`/?${p.toString()}`);
      return;
    }
    if (pendingSelection?.type === "place") {
      resolvePlace(pendingSelection.placeId, pendingSelection.text);
      return;
    }
    submitText(value);
  }, [pendingSelection, resolvePlace, submitText, value, filters, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectItem(activeIndex);
      } else if (isCompact) {
        submitText(value);
        setOpen(false);
      }
      // Large variant: plain Enter with nothing highlighted does nothing —
      // the user must press "Suchen" explicitly.
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* ── Input pill ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center",
          background: "var(--c-surface)",
          borderWidth: isCompact ? 1 : 1.5,
          borderStyle: "solid",
          borderColor: "var(--c-n200)",
          borderRadius: 9999,
          padding: isCompact ? "6px 6px 6px 14px" : "5px 5px 5px 20px",
          boxShadow: isCompact ? "var(--s-sm)" : "var(--s-md)",
          transition: "border-color .2s, box-shadow .2s",
          gap: 8,
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--c-gold)";
          (e.currentTarget as HTMLDivElement).style.boxShadow  =
            `0 0 0 3px var(--c-gold-light), ${isCompact ? "var(--s-sm)" : "var(--s-md)"}`;
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--c-n200)";
            (e.currentTarget as HTMLDivElement).style.boxShadow  =
              isCompact ? "var(--s-sm)" : "var(--s-md)";
          }
        }}
      >
        {/* Search icon */}
        <svg
          width={isCompact ? 14 : 16} height={isCompact ? 14 : 16}
          viewBox="0 0 24 24" fill="none" stroke="var(--c-n400)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }} aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActiveIndex(-1); setPendingSelection(null); }}
          onFocus={() => { if (value.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={
            isCompact
              ? "Stadt oder Region…"
              : restaurants.length > 0
                ? "Ort oder Restaurant…"
                : "Ort oder Region…"
          }
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1, minWidth: 0, width: "100%",
            border: "none", outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: isCompact ? "0.875rem" : "1rem",
            color: "var(--c-ink)",
          }}
        />

        {/* Search button (large only) */}
        {!isCompact && (
          <button
            type="button"
            onClick={() => { handleSearch(); setOpen(false); }}
            style={{
              flexShrink: 0,
              fontSize: "0.875rem", fontWeight: 500, letterSpacing: "0.03em",
              padding: "10px 24px", border: "none", borderRadius: 9999,
              background: "var(--c-burg)", color: "white",
              cursor: "pointer", fontFamily: "inherit",
              transition: "background .2s",
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(26% 0.080 17)"; }}
            onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = "var(--c-burg)"; }}
          >
            Suchen
          </button>
        )}
      </div>

      {/* ── Dropdown ───────────────────────────────────────────────────── */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0, right: 0,
            zIndex: 9999,
            background: "var(--c-surface)",
            border: "1px solid var(--c-n200)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            overflow: "hidden",
          }}
        >
          {/* Restaurants */}
          {restaurantMatches.length > 0 && (
            <>
              <div style={{
                padding: "8px 16px 4px",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--c-n400)",
              }}>
                Im Guide
              </div>
              {restaurantMatches.map((r, i) => (
                <button
                  key={r.id}
                  onMouseDown={(e) => { e.preventDefault(); selectItem(i); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px",
                    background: activeIndex === i ? "var(--c-n50)" : "transparent",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ flexShrink: 0, color: "var(--c-n400)", display: "flex" }}>
                    <IconList size={14} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    {r.cuisine && (
                      <div style={{ fontSize: "0.75rem", color: "var(--c-n400)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {r.cuisine}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Separator */}
          {restaurantMatches.length > 0 && predictions.length > 0 && (
            <div style={{ height: 1, background: "var(--c-n100)", margin: "4px 0" }} />
          )}

          {/* Location predictions */}
          {predictions.length > 0 && (
            <>
              <div style={{
                padding: "8px 16px 4px",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--c-n400)",
              }}>
                Orte
              </div>
              {predictions.map((pred, i) => {
                const idx = restaurantMatches.length + i;
                return (
                  <button
                    key={pred.placeId}
                    onMouseDown={(e) => { e.preventDefault(); selectItem(idx); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={{
                      width: "100%", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px",
                      background: activeIndex === idx ? "var(--c-n50)" : "transparent",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <svg
                      width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke="var(--c-n400)" strokeWidth={2} strokeLinecap="round"
                      strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {pred.mainText}
                      </div>
                      {pred.secondaryText && (
                        <div style={{ fontSize: "0.75rem", color: "var(--c-n400)" }}>
                          {pred.secondaryText}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Google attribution */}
          <div style={{ padding: "6px 14px 8px", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 9, color: "var(--c-n300)", letterSpacing: "0.04em" }}>
              Powered by Google
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LocationSearch(props: Props) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <LocationSearchInput {...props} />
    </APIProvider>
  );
}
