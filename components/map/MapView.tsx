"use client";

import { useState, useCallback, useEffect } from "react";
import mapStyle from "@/public/map-style.json";
import mapStyleDark from "@/public/map-style-dark.json";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import type { SpoonRating } from "@/types/database";
import { SPOON_RATINGS, SPOON_RATING_COLORS } from "@/lib/ratings";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapRestaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  spoon_rating: SpoonRating;
};

type Props = {
  restaurants: MapRestaurant[];
  /** Tailwind / CSS class applied to the outer container */
  className?: string;
  /** Initial map center — defaults to Paris */
  center?: { lat: number; lng: number };
  zoom?: number;
};

// ── Single marker with InfoWindow ─────────────────────────────────────────────
// Marker fill color is derived from SPOON_RATING_COLORS (shared brand tokens)
// rather than bespoke hex — keeps the pin color consistent with the rest of
// the app's rating color-coding and correct in dark mode.

function RestaurantMarker({
  restaurant,
  isSelected,
  onSelect,
  onClose,
}: {
  restaurant: MapRestaurant;
  isSelected: boolean;
  onSelect: (r: MapRestaurant) => void;
  onClose: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const rating = SPOON_RATINGS[restaurant.spoon_rating];
  const colors = SPOON_RATING_COLORS[restaurant.spoon_rating];
  const cfg = { ...rating, ...colors };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: restaurant.lat, lng: restaurant.lng }}
        onClick={() => onSelect(restaurant)}
        title={`${cfg.emoji} ${restaurant.name}`}
      >
        {/* Custom pin */}
        <div
          style={{
            background: cfg.text,
            border: "2px solid var(--c-surface)",
            boxShadow: isSelected
              ? `0 0 0 3px ${cfg.bg}, 0 4px 12px rgba(0,0,0,0.25)`
              : "0 2px 6px rgba(0,0,0,0.2)",
            transform: isSelected ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-base cursor-pointer select-none"
          aria-label={`${restaurant.name} — ${cfg.label}`}
        >
          {cfg.emoji}
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={onClose}
          headerDisabled
        >
          <div className="px-2 py-1.5 min-w-[160px] font-sans">
            <p
              className="text-sm font-semibold leading-snug mb-0.5"
              style={{ color: "#2a2528", fontFamily: "'Cormorant Garamond', serif" }}
            >
              {restaurant.name}
            </p>
            <p className="text-[11px] mb-2" style={{ color: cfg.text }}>
              {cfg.emoji} {cfg.label}
            </p>
            <a
              href={`/restaurant/${restaurant.id}`}
              className="text-[11px] font-medium underline-offset-2 hover:underline"
              style={{ color: "#b8952a" }}
            >
              View details →
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// ── Theme detection ───────────────────────────────────────────────────────────
// AdvancedMarker (the round emoji pins above) requires a Map ID, and Google
// silently ignores the `styles` JSON prop whenever a Map ID is set — so a
// single Map ID can't react to the light/dark toggle. Instead we swap between
// two Map IDs (each linked to its own style in the Google Cloud Console, same
// pattern as the light style already documented below) based on the current
// theme. ThemeToggle.tsx flips `<html data-theme>` directly (no event), so we
// watch it with a MutationObserver rather than relying on React state elsewhere.

function getEffectiveTheme(): "light" | "dark" {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useEffectiveTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getEffectiveTheme());

    const observer = new MutationObserver(() => setTheme(getEffectiveTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => setTheme(getEffectiveTheme());
    media.addEventListener("change", onMediaChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMediaChange);
    };
  }, []);

  return theme;
}

// ── Main component ────────────────────────────────────────────────────────────

const PARIS = { lat: 48.8566, lng: 2.3522 };

export function MapView({
  restaurants,
  className = "w-full h-full",
  center,
  zoom = 13,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = useEffectiveTheme();
  const isDark = theme === "dark";

  const handleSelect = useCallback((r: MapRestaurant) => {
    setSelectedId((prev) => (prev === r.id ? null : r.id));
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  // Derive center from data if not provided
  const mapCenter = center ?? (restaurants[0]
    ? { lat: restaurants[0].lat, lng: restaurants[0].lng }
    : PARIS);

  const mapId = isDark
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID)
    : process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        // Google's Map ID is immutable on an existing map instance — force a
        // clean remount when the theme (and therefore mapId) changes instead
        // of silently keeping the old style.
        key={mapId ?? "no-map-id"}
        className={className}
        defaultCenter={mapCenter}
        defaultZoom={zoom}
        mapId={mapId}
        // styles is ignored when mapId is set — apply the same JSON in
        // Google Cloud Console → Maps Platform → Map Styles and link it
        // to your Map ID (once for the light style, once more for the dark
        // one via NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK). The prop below acts
        // as a fallback for local dev when no Map ID is configured yet.
        styles={mapId ? undefined : (isDark ? mapStyleDark : mapStyle) as google.maps.MapTypeStyle[]}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        onClick={handleClose}
        style={{ borderRadius: "inherit" }}
      >
        {restaurants.map((r) => (
          <RestaurantMarker
            key={r.id}
            restaurant={r}
            isSelected={selectedId === r.id}
            onSelect={handleSelect}
            onClose={handleClose}
          />
        ))}
      </Map>
    </APIProvider>
  );
}
