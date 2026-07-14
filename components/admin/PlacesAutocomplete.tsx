"use client";

import { useEffect, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlaceSelection = {
  placeId: string;
  name:    string;
  lat:     number;
  lng:     number;
};

type Props = {
  onSelect:              (place: PlaceSelection) => void;
  defaultValue?:         string;
  placeholder?:          string;
  componentRestrictions?: google.maps.places.ComponentRestrictions;
};

// ── Component ─────────────────────────────────────────────────────────────────
// Must be rendered inside an <APIProvider> with the places library available.

export function PlacesAutocomplete({
  onSelect,
  defaultValue    = "",
  placeholder     = "Restaurant auf Google Maps suchen…",
  componentRestrictions,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const placesLib    = useMapsLibrary("places");

  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;
    if (containerRef.current.childElementCount > 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places = google.maps.places as any;
    let cleanup: () => void;

    if (typeof places.PlaceAutocompleteElement === "function") {
      // ── New Places API ────────────────────────────────────────────
      const el: HTMLElement = new places.PlaceAutocompleteElement({
        types:                ["establishment"],
        ...(componentRestrictions ? { componentRestrictions } : {}),
      });
      el.style.cssText = "width:100%;display:block;";
      containerRef.current.appendChild(el);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = async (e: any) => {
        const place = e.place;
        await place.fetchFields({
          fields: ["id", "location", "displayName"],
        });
        if (!place.location) return;
        onSelectRef.current({
          placeId: place.id    ?? "",
          name:    place.displayName ?? "",
          lat:     place.location.lat(),
          lng:     place.location.lng(),
        });
      };

      el.addEventListener("gmp-placeselect", handler);
      cleanup = () => {
        el.removeEventListener("gmp-placeselect", handler);
        if (containerRef.current?.contains(el)) containerRef.current.removeChild(el);
      };
    } else {
      // ── Legacy Autocomplete fallback ──────────────────────────────
      const input           = document.createElement("input");
      input.type            = "text";
      input.defaultValue    = defaultValue;
      input.placeholder     = placeholder;
      input.autocomplete    = "off";
      input.className       = [
        "w-full rounded-lg border border-stone-200 bg-white",
        "pl-9 pr-3 py-2.5 text-sm text-stone-900",
        "placeholder:text-stone-400",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/40",
        "focus:border-amber-400 transition-colors",
      ].join(" ");
      containerRef.current.appendChild(input);

      const ac = new placesLib.Autocomplete(input, {
        types:  ["establishment"],
        fields: ["place_id", "name", "geometry.location"],
        ...(componentRestrictions ? { componentRestrictions } : {}),
      });

      const listener = ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.place_id || !place.geometry?.location) return;
        onSelectRef.current({
          placeId: place.place_id,
          name:    place.name ?? "",
          lat:     place.geometry.location.lat(),
          lng:     place.geometry.location.lng(),
        });
      });

      cleanup = () => {
        listener.remove();
        if (containerRef.current?.contains(input)) containerRef.current.removeChild(input);
      };
    }

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib]);

  return (
    <div className="relative">
      {/* Google Maps pin icon */}
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center z-10">
        <svg className="h-4 w-4 text-stone-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      </div>
      <div ref={containerRef} style={{ width: "100%" }} />
    </div>
  );
}
