"use client";

import { useEffect, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlaceSelection = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  onSelect: (place: PlaceSelection) => void;
  defaultValue?: string;
  placeholder?: string;
  /** Restrict predictions to specific countries, e.g. ['fr'] */
  componentRestrictions?: google.maps.places.ComponentRestrictions;
};

// ── Component ─────────────────────────────────────────────────────────────────
// Must be rendered inside an <APIProvider> with the places library available.

export function PlacesAutocomplete({
  onSelect,
  defaultValue = "",
  placeholder = "Search Google Maps for a restaurant…",
  componentRestrictions,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");

  // Keep a stable ref to the callback so the Autocomplete listener doesn't
  // need to be recreated when the parent re-renders.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      types: ["establishment"],
      fields: ["place_id", "name", "geometry.location"],
      ...(componentRestrictions ? { componentRestrictions } : {}),
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.place_id || !place.geometry?.location) return;

      onSelectRef.current({
        placeId: place.place_id,
        name: place.name ?? "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
    });

    return () => listener.remove();
    // Only re-run when the places library loads — intentionally omit componentRestrictions
    // from deps to avoid recreating the widget on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib]);

  return (
    <div className="relative">
      {/* Google icon hint */}
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <svg
          className="h-4 w-4 text-stone-400"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
        autoComplete="off"
      />
    </div>
  );
}
