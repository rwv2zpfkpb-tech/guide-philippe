"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useRouter } from "next/navigation";
import { IconList, IconLocate } from "@/components/icons";

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
  // Raw google.maps.places.PlacePrediction — kept around (not just the
  // extracted text fields) so resolvePlace() can call .toPlace() on it,
  // which automatically carries the AutocompleteSessionToken from the
  // original request into the following fetchFields() call (s. sessionTokenRef
  // below). Reconstructing a bare `new Place({ id })` instead would lose that
  // link and bill the session as two separate, full-price requests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placePrediction: any;
};

// Large variant: picking a *location* suggestion only fills the field — it's
// remembered here and only resolved/navigated-to once the user explicitly
// presses "Suchen". Picking a concrete restaurant ("Im Guide") instead
// navigates straight to its detail page (s. selectItem below) — there's no
// search to run for an already-identified restaurant.
type PendingSelection = { type: "place"; prediction: Prediction };

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
  filters: SearchFilters,
  ownLocation = false
) {
  // ne_lat/ne_lng/sw_lat/sw_lng are carried along in the URL purely as
  // round-trip metadata (SearchResultsView re-serializes them when the
  // staged filters/sort change) — they are NOT used as a DB filter on the
  // server (see app/page.tsx), only lat/lng (map center) matter there.
  // Using Google's per-place viewport as a hard geographic cutoff used to
  // drop obviously-nearby restaurants unpredictably, since viewport size
  // varies wildly by place type (city-sized for "Berlin", a few hundred
  // meters for a single street address) — same reasoning as the
  // "Standort verwenden" fix, s. Roadmap-Schritt 15/17.
  const delta = 0.5;
  const p = new URLSearchParams({
    location: name,
    lat:    String(lat),
    lng:    String(lng),
    ne_lat: String(viewport ? viewport.getNorthEast().lat() : lat + delta),
    ne_lng: String(viewport ? viewport.getNorthEast().lng() : lng + delta),
    sw_lat: String(viewport ? viewport.getSouthWest().lat() : lat - delta),
    sw_lng: String(viewport ? viewport.getSouthWest().lng() : lng - delta),
  });
  // Marks this search as originating from the device's actual GPS position
  // rather than a typed/selected place — read by app/page.tsx to pass a
  // "myLocation" pin down to MapView and by SearchResultsView to default
  // the sort control to "Entfernung".
  if (ownLocation) p.set("own_location", "1");
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
  // True while a selected place/text is being resolved to lat/lng via the
  // Google Places/Geocoder API — happens *before* router.push, so it isn't
  // covered by the route-level loading.tsx spinner. Without this the
  // "Suchen" button (and compact-mode selections) look unresponsive for the
  // ~0.5-1s round trip.
  const [resolving, setResolving] = useState(false);
  // Wraps every router.push below — isNavigating stays true for the whole
  // route transition (not just until push() is *called*), so the spinner
  // doesn't drop out right as the new page/search results are still loading.
  const [isNavigating, startNavTransition] = useTransition();
  const busy = resolving || isNavigating;

  // "Standort verwenden" — geolocates the device via the browser API and
  // searches from there directly. A reverse-geocode call still runs
  // afterwards, but purely for a human-readable location label; navigation
  // happens either way.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One token spans every keystroke of a single search plus the terminating
  // Place Details fetch (via PlacePrediction.toPlace(), s. Prediction type
  // above) — Google bills that whole bundle as a single Autocomplete
  // session instead of pricing every debounced suggestions request and the
  // final Details call separately. Reset to null once a selection resolves
  // so the next search starts a fresh session.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);

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
        if (!sessionTokenRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sessionTokenRef.current = new (google.maps.places as any).AutocompleteSessionToken();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { suggestions } = await (google.maps.places as any).AutocompleteSuggestion
          .fetchAutocompleteSuggestions({
            input: value,
            includedPrimaryTypes: ["geocode"],
            sessionToken: sessionTokenRef.current,
          });
        setRawPredictions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (suggestions as any[])
            .filter((s) => s.placePrediction)
            .slice(0, 4)
            .map((s) => ({
              placeId:         s.placePrediction.placeId,
              mainText:        s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? "",
              secondaryText:   s.placePrediction.secondaryText?.text ?? "",
              placePrediction: s.placePrediction,
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
    async (prediction: Prediction) => {
      setResolving(true);
      try {
        // .toPlace() carries the AutocompleteSessionToken from the original
        // suggestions request into this fetchFields() call automatically —
        // that's what bundles the whole search into one billed Autocomplete
        // session instead of a separate per-keystroke charge plus a
        // separate Place Details charge (s. sessionTokenRef above).
        const place = prediction.placePrediction
          ? prediction.placePrediction.toPlace()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : new (google.maps.places as any).Place({ id: prediction.placeId });
        await place.fetchFields({ fields: ["location", "formattedAddress", "viewport"] });
        sessionTokenRef.current = null; // session consumed — next search gets a fresh token
        if (!place.location) {
          setResolving(false);
          return;
        }
        setResolving(false);
        startNavTransition(() => {
          navigateToLocation(
            router,
            place.location.lat(),
            place.location.lng(),
            place.formattedAddress ?? prediction.mainText,
            place.viewport,
            filters
          );
        });
      } catch {
        sessionTokenRef.current = null;
        // fallback: geocode by text
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: prediction.mainText }, (results, status) => {
          setResolving(false);
          if (status !== "OK" || !results?.[0]) return;
          const loc = results[0].geometry.location;
          startNavTransition(() => {
            navigateToLocation(router, loc.lat(), loc.lng(), results[0].formatted_address, results[0].geometry.viewport, filters);
          });
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
        resolvePlace(predictions[0]);
        return;
      }
      // Fallback: geocode directly
      setResolving(true);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: text }, (results, status) => {
        setResolving(false);
        if (status !== "OK" || !results?.[0]) return;
        const loc = results[0].geometry.location;
        startNavTransition(() => {
          navigateToLocation(
            router,
            loc.lat(), loc.lng(),
            results[0].formatted_address,
            results[0].geometry.viewport,
            filters
          );
        });
      });
    },
    [predictions, resolvePlace, router, filters]
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }
    setLocateError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Reverse-geocode purely for a human-readable label — falls back to
        // a generic name if it fails, navigation happens either way.
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setLocating(false);
          const name = status === "OK" && results?.[0] ? results[0].formatted_address : "Mein Standort";
          startNavTransition(() => {
            navigateToLocation(router, lat, lng, name, null, filters, true);
          });
        });
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Standortzugriff wurde verweigert."
            : "Standort konnte nicht ermittelt werden."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [router, filters]);

  // A concrete restaurant ("Im Guide") is already identified — selecting one
  // navigates straight to its detail page in both variants, no staging/
  // "Suchen" step needed (that step only makes sense for locations, which
  // still need geocoding before they can be searched). Location suggestions
  // keep the existing size-dependent behavior: compact navigates immediately,
  // large only fills the field and waits for "Suchen" click.
  const selectItem = useCallback(
    (index: number) => {
      setOpen(false);
      if (index < restaurantMatches.length) {
        startNavTransition(() => {
          router.push(`/restaurant/${restaurantMatches[index].id}`);
        });
      } else {
        const pred = predictions[index - restaurantMatches.length];
        if (isCompact) {
          resolvePlace(pred);
        } else {
          setValue(pred.mainText);
          setPendingSelection({ type: "place", prediction: pred });
        }
      }
    },
    [restaurantMatches, predictions, resolvePlace, router, isCompact]
  );

  const handleSearch = useCallback(() => {
    if (pendingSelection?.type === "place") {
      resolvePlace(pendingSelection.prediction);
      return;
    }
    submitText(value);
  }, [pendingSelection, resolvePlace, submitText, value]);

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
        {/* Search icon — swapped for a spinner while a selection is being
            resolved to coordinates and while the resulting navigation is
            still in flight (busy = resolving || isNavigating, s. above) —
            keeps the icon spinning across the whole gap, not just the part
            before router.push. */}
        {busy ? (
          <div className="gp-spinner-sm" style={{ color: "var(--c-n400)" }} aria-hidden />
        ) : (
          <svg
            width={isCompact ? 14 : 16} height={isCompact ? 14 : 16}
            viewBox="0 0 24 24" fill="none" stroke="var(--c-n400)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }} aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActiveIndex(-1); setPendingSelection(null); }}
          onFocus={() => { if (value.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          disabled={busy || locating}
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
            opacity: (busy || locating) ? 0.6 : 1,
          }}
        />

        {/* "Standort verwenden" — available in both variants; unlike the
            Suchen button (large only) this acts immediately, there's
            nothing to stage first. */}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating || busy}
          aria-busy={locating || isNavigating}
          aria-label="Meinen Standort verwenden"
          title="Meinen Standort verwenden"
          style={{
            flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: isCompact ? 30 : 34, height: isCompact ? 30 : 34,
            borderRadius: "50%", border: "1px solid var(--c-n200)",
            background: "var(--c-surface)", color: "var(--c-n500)",
            cursor: (locating || busy) ? "default" : "pointer",
            opacity: (locating || busy) ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {(locating || isNavigating) ? (
            <span className="gp-spinner-sm" aria-hidden />
          ) : (
            <IconLocate size={isCompact ? 14 : 16} />
          )}
        </button>

        {/* Search button (large only) */}
        {!isCompact && (
          <button
            type="button"
            onClick={() => { handleSearch(); setOpen(false); }}
            disabled={busy || locating}
            aria-busy={busy}
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: "0.875rem", fontWeight: 500, letterSpacing: "0.03em",
              padding: "10px 24px", border: "none", borderRadius: 9999,
              background: "var(--c-burg)", color: "white",
              cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              opacity: busy ? 0.75 : 1,
              transition: "background .2s, opacity .2s",
            }}
            onMouseOver={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.background = "oklch(26% 0.080 17)"; }}
            onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = "var(--c-burg)"; }}
          >
            {busy && <span className="gp-spinner-sm" aria-hidden />}
            {busy ? "Sucht…" : "Suchen"}
          </button>
        )}
      </div>

      {locateError && (
        <p style={{ marginTop: 6, marginLeft: 4, fontSize: "0.75rem", color: "var(--c-burg)" }}>
          {locateError}
        </p>
      )}

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
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} language="de" region="DE">
      <LocationSearchInput {...props} />
    </APIProvider>
  );
}
