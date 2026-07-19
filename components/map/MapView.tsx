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
  useMap,
} from "@vis.gl/react-google-maps";
import type { SpoonRating, RestaurantStatus } from "@/types/database";
import { SPOON_RATINGS, SPOON_RATING_COLORS } from "@/lib/ratings";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapRestaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  spoon_rating: SpoonRating;
  /** Optional — only set when the "Entwürfe in der Suche zeigen"-Toggle
   *  (app/actions/restaurants.ts) let a draft reach the map, so its
   *  InfoWindow can badge it accordingly. */
  status?: RestaurantStatus;
};

type Props = {
  restaurants: MapRestaurant[];
  /** Tailwind / CSS class applied to the outer container */
  className?: string;
  /** Initial map center — defaults to Paris */
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Device GPS position — renders a distinct "you are here" dot. Only set
   *  when the current search actually originated from "Standort verwenden"
   *  (own_location=1), not for an arbitrary searched place. */
  myLocation?: { lat: number; lng: number } | null;
  /** Controlled selection (e.g. the expanded row in SearchResultsView's
   *  result list) — when set, the matching marker is highlighted and its
   *  InfoWindow opens, same as clicking the marker directly. Omit for
   *  purely map-driven (uncontrolled) selection. */
  selectedId?: string | null;
  /** Fires whenever the selection changes, whether triggered by a marker
   *  click/close or (in controlled mode) mirrors `selectedId` back —
   *  lets callers keep an external list selection in sync with the map. */
  onSelectedChange?: (id: string | null) => void;
};

// Pans the map to the currently selected marker so a highlight triggered
// from outside the map (e.g. expanding a row in the result list) is
// actually visible, not just highlighted off-screen. A no-op child of
// <Map> rather than logic in the parent, since useMap() only works inside
// the APIProvider/Map tree.
function PanToSelected({ restaurants, selectedId }: { restaurants: MapRestaurant[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !selectedId) return;
    const r = restaurants.find((x) => x.id === selectedId);
    if (r) map.panTo({ lat: r.lat, lng: r.lng });
  }, [map, selectedId, restaurants]);
  return null;
}

// "You are here" dot — deliberately the same blue in both themes (the
// universal GPS-dot convention from native map apps) rather than a
// SPOON_RATING_COLORS/app-token color, since it isn't a rating indicator.
function MyLocationMarker({ position }: { position: { lat: number; lng: number } }) {
  return (
    <AdvancedMarker position={position} title="Dein Standort">
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#4285F4",
          border: "3px solid var(--c-surface)",
          boxShadow: "0 0 0 4px rgba(66,133,244,0.3), 0 2px 6px rgba(0,0,0,0.3)",
        }}
        aria-label="Dein Standort"
      />
    </AdvancedMarker>
  );
}

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
          <div className="gp-iw px-3 py-2.5 min-w-[220px] font-sans">
            <p
              className="text-lg font-semibold leading-snug mb-1"
              style={{ color: "var(--c-ink)", fontFamily: "'Cormorant Garamond', serif" }}
            >
              {restaurant.name}
              {restaurant.status === "draft" && (
                <span
                  className="ml-2 align-middle rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--c-gold)", background: "var(--c-gold-light)" }}
                >
                  Entwurf
                </span>
              )}
            </p>
            <p className="text-sm mb-3" style={{ color: cfg.text }}>
              {cfg.emoji} {cfg.label}
            </p>
            <a
              href={`/restaurant/${restaurant.id}`}
              className="text-sm font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--c-gold)" }}
            >
              Details ansehen →
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
  myLocation,
  selectedId: selectedIdProp,
  onSelectedChange,
}: Props) {
  // Uncontrolled fallback selection — only used when the caller doesn't
  // pass `selectedId` (standalone map usage, e.g. the detail page has no
  // list to sync against).
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const isControlled = selectedIdProp !== undefined;
  const selectedId = isControlled ? selectedIdProp : internalSelectedId;
  const theme = useEffectiveTheme();
  const isDark = theme === "dark";

  const setSelectedId = useCallback((id: string | null) => {
    if (!isControlled) setInternalSelectedId(id);
    onSelectedChange?.(id);
  }, [isControlled, onSelectedChange]);

  const handleSelect = useCallback((r: MapRestaurant) => {
    setSelectedId(selectedId === r.id ? null : r.id);
  }, [selectedId, setSelectedId]);

  const handleClose = useCallback(() => setSelectedId(null), [setSelectedId]);

  // Derive center from data if not provided
  const mapCenter = center ?? (restaurants[0]
    ? { lat: restaurants[0].lat, lng: restaurants[0].lng }
    : PARIS);

  const mapId = isDark
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID)
    : process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} language="de" region="DE">
      <Map
        // defaultCenter/defaultZoom below are uncontrolled — vis.gl only
        // applies them on mount, so panning/zooming during a session isn't
        // fought by React. That means a *new* search (e.g. via the compact
        // search bar inside SearchResultsView) wouldn't otherwise move the
        // map at all, since `center` changing alone doesn't remount it.
        // Keying on the center (in addition to the Map ID, for the
        // light/dark remount below) forces a clean remount whenever the
        // searched location actually changes.
        key={`${mapId ?? "no-map-id"}-${mapCenter.lat}-${mapCenter.lng}`}
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
        {myLocation && <MyLocationMarker position={myLocation} />}
        <PanToSelected restaurants={restaurants} selectedId={selectedId} />
      </Map>
    </APIProvider>
  );
}
