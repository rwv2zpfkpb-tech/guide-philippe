"use client";

import { useState, useCallback } from "react";
import mapStyle from "@/public/map-style.json";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import type { SpoonRating } from "@/types/database";

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

// ── Rating visuals ────────────────────────────────────────────────────────────

const RATING = {
  3: { emoji: "🍽️", label: "Absolute Recommendation", bg: "#4a1520", border: "#7a2535" },
  2: { emoji: "🍴", label: "Worth Mentioning",         bg: "#b8952a", border: "#d4af37" },
  1: { emoji: "🥄", label: "Remembering",              bg: "#6b6560", border: "#8a8480" },
  0: { emoji: "🫗", label: "Not Recommended",          bg: "#9e9790", border: "#bcb5ae" },
} satisfies Record<SpoonRating, { emoji: string; label: string; bg: string; border: string }>;

// ── Single marker with InfoWindow ─────────────────────────────────────────────

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
  const cfg = RATING[restaurant.spoon_rating] ?? RATING[0];

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
            background: cfg.bg,
            border: `2px solid ${cfg.border}`,
            boxShadow: isSelected
              ? `0 0 0 3px ${cfg.border}55, 0 4px 12px rgba(0,0,0,0.25)`
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
            <p className="text-[11px] mb-2" style={{ color: cfg.bg }}>
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

// ── Main component ────────────────────────────────────────────────────────────

const PARIS = { lat: 48.8566, lng: 2.3522 };

export function MapView({
  restaurants,
  className = "w-full h-full",
  center,
  zoom = 13,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((r: MapRestaurant) => {
    setSelectedId((prev) => (prev === r.id ? null : r.id));
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  // Derive center from data if not provided
  const mapCenter = center ?? (restaurants[0]
    ? { lat: restaurants[0].lat, lng: restaurants[0].lng }
    : PARIS);

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        className={className}
        defaultCenter={mapCenter}
        defaultZoom={zoom}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        // styles is ignored when mapId is set — apply the same JSON in
        // Google Cloud Console → Maps Platform → Map Styles and link it
        // to your Map ID. The prop below acts as a fallback for local dev
        // when NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID is not yet configured.
        styles={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ? undefined : (mapStyle as google.maps.MapTypeStyle[])}
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
