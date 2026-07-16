"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { APIProvider } from "@vis.gl/react-google-maps";
import {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  deleteRestaurants,
  getRestaurantById,
} from "@/app/actions/restaurants";
import { getPlaceDetails } from "@/app/actions/places";
import { createReview, updateReview, type ReviewPayload } from "@/app/actions/reviews";
import {
  previewCsvImport,
  confirmCsvImport,
  type CsvImportRow,
} from "@/app/actions/csvImport";
import {
  approveProfile,
  rejectProfile,
  promoteToAdmin,
  demoteFromAdmin,
  deleteUserAccount,
  type ProfileWithEmail,
} from "@/app/actions/profiles";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/admin";
import { BackButton } from "@/components/BackButton";
import { IconChevronDown } from "@/components/icons";
import { PlacesAutocomplete, type PlaceSelection } from "@/components/admin/PlacesAutocomplete";
import {
  SPOON_RATINGS,
  SPOON_RATING_COLORS,
  SPOON_RATING_ORDER,
  REVIEW_CATEGORY_ORDER,
  REVIEW_CATEGORY_LABELS,
} from "@/lib/ratings";
import { RatingDots } from "@/components/RatingDots";
import type {
  Restaurant,
  SpoonRating,
  PriceLevel,
  RestaurantStatus,
  ReviewCategory,
  ReviewWithCategories,
} from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPOON_OPTIONS = SPOON_RATING_ORDER.map((value) => ({
  value,
  emoji: SPOON_RATINGS[value].emoji,
  label: SPOON_RATINGS[value].label,
}));

const PRICE_OPTIONS: { value: PriceLevel; label: string }[] = [
  { value: 0, label: "Kostenlos" },
  { value: 1, label: "€" },
  { value: 2, label: "€€" },
  { value: 3, label: "€€€" },
  { value: 4, label: "€€€€" },
];

// ── Form state ────────────────────────────────────────────────────────────────

type CategoryFormData = { heading: string; body: string; rating: number | null };

type ReviewFormData = {
  visited_at: string; // yyyy-mm-dd
  spoon_rating: SpoonRating;
  fazit: string;
  asNewVisit: boolean;
  categories: Record<ReviewCategory, CategoryFormData>;
};

type FormData = {
  name: string;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  address: string;
  phone: string;
  website: string;
  opening_hours: string;
  cuisine: string;
  price_level: PriceLevel | null;
  status: RestaurantStatus;
  review: ReviewFormData;
};

type ContactField = "phone" | "website" | "opening_hours";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyCategories(): Record<ReviewCategory, CategoryFormData> {
  return Object.fromEntries(
    REVIEW_CATEGORY_ORDER.map((c) => [c, { heading: "", body: "", rating: null }])
  ) as Record<ReviewCategory, CategoryFormData>;
}

const emptyForm = (): FormData => ({
  name: "",
  google_place_id: "",
  lat: null,
  lng: null,
  address: "",
  phone: "",
  website: "",
  opening_hours: "",
  cuisine: "",
  price_level: null,
  status: "published",
  review: {
    visited_at: todayISO(),
    spoon_rating: 3,
    fazit: "",
    asNewVisit: false,
    categories: emptyCategories(),
  },
});

function formFromRestaurant(r: Restaurant, latest: ReviewWithCategories | null): FormData {
  const categories = emptyCategories();
  for (const c of latest?.categories ?? []) {
    categories[c.category] = { heading: c.heading ?? "", body: c.body ?? "", rating: c.rating };
  }

  return {
    name: r.name,
    google_place_id: r.google_place_id ?? "",
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? "",
    phone: r.phone ?? "",
    website: r.website ?? "",
    opening_hours: r.opening_hours ?? "",
    cuisine: r.cuisine ?? "",
    price_level: r.price_level,
    status: r.status,
    review: {
      visited_at: latest?.visited_at ?? todayISO(),
      spoon_rating: latest?.spoon_rating ?? r.spoon_rating,
      fazit: latest?.fazit ?? "",
      asNewVisit: false,
      categories,
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpoonBadge({ rating }: { rating: SpoonRating }) {
  const opt = SPOON_OPTIONS.find((o) => o.value === rating)!;
  const colors = SPOON_RATING_COLORS[rating];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider"
      style={{ color: colors.text, background: colors.bg }}
      title={opt.label}
    >
      <span className="text-sm">{opt.emoji}</span>
    </span>
  );
}

function PriceBadge({ level }: { level: PriceLevel | null }) {
  if (level == null) return <span className="text-[var(--c-n400)]">—</span>;
  if (level === 0) return <span className="font-mono text-xs text-[var(--c-n400)]">Kostenlos</span>;
  const full = "€".repeat(level);
  const empty = "€".repeat(4 - level);
  return (
    <span className="font-mono text-xs">
      <span className="text-[var(--c-ink)]">{full}</span>
      <span className="text-[var(--c-n300)]">{empty}</span>
    </span>
  );
}

// ── Cuisine combobox ─────────────────────────────────────────────────────────
// Free-text input with a real filtered dropdown (not a native <input list>,
// whose disclosure arrow/filtering behaves inconsistently across browsers and
// looked like a dropdown that "didn't work"). Suggestions come from the
// cuisine values already used across existing restaurants (getCuisines()),
// not a hardcoded list — filtered by substring match as the admin types
// (e.g. "ca" matches "Café"). Still a free-text field: anything typed that
// isn't in the list is kept as-is.

function CuisineCombobox({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(value.trim().toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="z. B. Italienisch…"
        className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] pl-3 pr-8 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
      />
      <IconChevronDown
        size={14}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-n400)] transition-transform ${open ? "rotate-180" : ""}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] shadow-lg py-1">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                // Fires before the input's onBlur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setOpen(false);
                }}
                className="block w-full text-left px-3 py-1.5 text-sm text-[var(--c-ink)] hover:bg-[var(--c-n50)]"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Edit / Create slide-over ──────────────────────────────────────────────────

const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  phone: "Telefonnummer",
  website: "Website",
  opening_hours: "Öffnungszeiten",
};

function EditPanel({
  open,
  isNew,
  form,
  manualEntry,
  onManualEntryToggle,
  placePhotos,
  placePhotosLoading,
  pastReviews,
  cuisineSuggestions,
  visibleContactFields,
  onToggleContactField,
  onFormChange,
  onReviewChange,
  onCategoryChange,
  onPlaceSelect,
  onSave,
  onClose,
  saving,
}: {
  open: boolean;
  isNew: boolean;
  manualEntry: boolean;
  onManualEntryToggle: () => void;
  placePhotos: string[];
  placePhotosLoading: boolean;
  form: FormData;
  pastReviews: ReviewWithCategories[];
  cuisineSuggestions: string[];
  visibleContactFields: Set<ContactField>;
  onToggleContactField: (field: ContactField) => void;
  onFormChange: (patch: Partial<FormData>) => void;
  onReviewChange: (patch: Partial<ReviewFormData>) => void;
  onCategoryChange: (category: ReviewCategory, patch: Partial<CategoryFormData>) => void;
  onPlaceSelect: (place: PlaceSelection) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex flex-col w-full max-w-lg sm:max-w-xl lg:max-w-2xl bg-[var(--c-bg)] shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-n100)]">
          <h2 className="font-serif text-lg font-semibold text-[var(--c-ink)]">
            {isNew ? "Add Restaurant" : "Edit Restaurant"}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--c-n400)] hover:text-[var(--c-n700)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Google Places search (or manual fallback) ── */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">
                {manualEntry ? "Ort manuell erfassen" : "Find on Google Maps"}
              </label>
              <button
                type="button"
                onClick={onManualEntryToggle}
                className="shrink-0 text-xs font-medium text-[var(--c-burg)] hover:opacity-80"
              >
                {manualEntry ? "Google-Suche verwenden" : "Ort manuell erfassen"}
              </button>
            </div>

            {manualEntry ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onFormChange({ name: e.target.value })}
                  placeholder="Name des Restaurants"
                  className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                />
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => onFormChange({ address: e.target.value })}
                  placeholder="Adresse (z. B. Musterstraße 1, 12345 Berlin)"
                  className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    value={form.lat ?? ""}
                    onChange={(e) => onFormChange({ lat: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Latitude (optional)"
                    className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm font-mono text-[var(--c-ink)] placeholder:text-[var(--c-n400)] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                  />
                  <input
                    type="number"
                    step="any"
                    value={form.lng ?? ""}
                    onChange={(e) => onFormChange({ lng: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Longitude (optional)"
                    className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm font-mono text-[var(--c-ink)] placeholder:text-[var(--c-n400)] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                  />
                </div>
                <p className="text-xs text-[var(--c-n400)]">
                  Ohne Google-Platz-ID gibt es keine Live-Öffnungszeiten/Fotos auf der Detailseite — nur die hier gespeicherte Adresse. Latitude/Longitude sind nur für die Kartenanzeige nötig.
                </p>
              </div>
            ) : (
              <>
                <PlacesAutocomplete
                  onSelect={onPlaceSelect}
                  defaultValue={form.name}
                  placeholder="Search establishment…"
                />
                {form.google_place_id && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--c-success)]/30 bg-[var(--c-success-light)] px-3 py-2 text-xs">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-[var(--c-success)] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--c-n700)] truncate">{form.name}</div>
                      <div className="text-[var(--c-n500)] truncate">
                        {form.address
                          ? form.address
                          : form.lat !== null && form.lng !== null
                          ? `${form.lat.toFixed(6)}, ${form.lng.toFixed(6)}`
                          : "Keine Adresse verfügbar"}
                      </div>
                    </div>
                  </div>
                )}
                {placePhotosLoading && (
                  <p className="mt-2 text-xs text-[var(--c-n400)]">Lade Fotos von Google Maps…</p>
                )}
                {!placePhotosLoading && placePhotos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {placePhotos.slice(0, 3).map((uri, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={uri}
                        alt=""
                        className="aspect-square w-full rounded-lg object-cover border border-[var(--c-n100)]"
                      />
                    ))}
                  </div>
                )}

                {/* ── Coordinates (read-only preview) ── */}
                {(form.lat !== null && form.lng !== null) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1">Latitude</label>
                      <div className="rounded-lg border border-[var(--c-n100)] bg-[var(--c-n50)] px-3 py-2 text-sm font-mono text-[var(--c-n600)]">{form.lat?.toFixed(6)}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1">Longitude</label>
                      <div className="rounded-lg border border-[var(--c-n100)] bg-[var(--c-n50)] px-3 py-2 text-sm font-mono text-[var(--c-n600)]">{form.lng?.toFixed(6)}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <hr className="border-[var(--c-n100)]" />

          {/* ── Cuisine ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Cuisine
            </label>
            {/* Auto-filled from Google Maps on place selection, but a free-text
                input (not a fixed select) so it always stays editable/correctable.
                Suggestions in the dropdown come from cuisines already used
                across existing restaurants, filtered as you type. */}
            <CuisineCombobox
              value={form.cuisine}
              onChange={(v) => onFormChange({ cuisine: v })}
              suggestions={cuisineSuggestions}
            />
          </div>

          {/* ── Kontakt & Öffnungszeiten (optional) ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Kontakt & Öffnungszeiten
            </label>
            <p className="text-xs text-[var(--c-n400)] mb-2">
              Telefon/Website werden bei einer Google-Auswahl automatisch übernommen, falls verfügbar — hier korrigierbar. Öffnungszeiten sind ein manueller Fallback, falls Google keine Live-Öffnungszeiten liefert.
            </p>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {(Object.keys(CONTACT_FIELD_LABELS) as ContactField[]).map((field) => {
                const active = visibleContactFields.has(field);
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => onToggleContactField(field)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-ink)]"
                        : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n500)] hover:border-[var(--c-n300)]"
                    }`}
                  >
                    {active ? "− " : "+ "}
                    {CONTACT_FIELD_LABELS[field]}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2.5">
              {visibleContactFields.has("phone") && (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => onFormChange({ phone: e.target.value })}
                  placeholder="Telefonnummer, z. B. +49 30 1234567"
                  className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                />
              )}
              {visibleContactFields.has("website") && (
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => onFormChange({ website: e.target.value })}
                  placeholder="Website, z. B. https://restaurant.de"
                  className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                />
              )}
              {visibleContactFields.has("opening_hours") && (
                <textarea
                  value={form.opening_hours}
                  onChange={(e) => onFormChange({ opening_hours: e.target.value })}
                  rows={3}
                  placeholder="z. B. Mo–Fr 12–22 Uhr, Sa/So geschlossen"
                  className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)] resize-none"
                />
              )}
            </div>
          </div>

          {/* ── Price level ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Price Level
            </label>
            <div className="flex gap-2">
              {PRICE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onFormChange({ price_level: value })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-mono transition-colors ${
                    form.price_level === value
                      ? "border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-ink)] font-semibold"
                      : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:border-[var(--c-n300)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sichtbarkeit (Entwurf/veröffentlicht) ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Sichtbarkeit
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-[var(--c-n200)] px-3 py-2.5 text-sm text-[var(--c-ink)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.status === "draft"}
                onChange={(e) =>
                  onFormChange({ status: e.target.checked ? "draft" : "published" })
                }
                className="rounded border-[var(--c-n300)]"
              />
              Als Entwurf speichern (für Nutzer unsichtbar, bis veröffentlicht)
            </label>
          </div>

          {/* ── Aktuelle Bewertung (aktuellster Aufenthalt) ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Aktuelle Bewertung
            </label>

            {!isNew && (
              <label className="flex items-center gap-2 mb-3 text-xs text-[var(--c-n600)]">
                <input
                  type="checkbox"
                  checked={form.review.asNewVisit}
                  onChange={(e) =>
                    onReviewChange({
                      asNewVisit: e.target.checked,
                      visited_at: e.target.checked ? todayISO() : form.review.visited_at,
                    })
                  }
                  className="rounded border-[var(--c-n300)]"
                />
                Als neuen Aufenthalt speichern (bisherige Bewertung wird archiviert)
              </label>
            )}

            <div className="mb-3">
              <label className="block text-xs text-[var(--c-n500)] mb-1">Datum</label>
              <input
                type="date"
                value={form.review.visited_at}
                onChange={(e) => onReviewChange({ visited_at: e.target.value })}
                className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
              />
            </div>

            <div className="space-y-2 mb-3">
              {SPOON_OPTIONS.map(({ value, emoji, label }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    form.review.spoon_rating === value
                      ? "border-[var(--c-burg)] bg-[var(--c-burg)]/5"
                      : "border-[var(--c-n200)] bg-[var(--c-surface)] hover:border-[var(--c-n300)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="spoon_rating"
                    value={value}
                    checked={form.review.spoon_rating === value}
                    onChange={() => onReviewChange({ spoon_rating: value })}
                    className="sr-only"
                  />
                  <span className="text-lg">{emoji}</span>
                  <div>
                    <p className={`text-sm font-medium ${form.review.spoon_rating === value ? "text-[var(--c-burg)]" : "text-[var(--c-ink)]"}`}>
                      {label}
                    </p>
                  </div>
                  {form.review.spoon_rating === value && (
                    <svg className="ml-auto w-4 h-4 text-[var(--c-burg)]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>

            <textarea
              value={form.review.fazit}
              onChange={(e) => onReviewChange({ fazit: e.target.value })}
              rows={5}
              placeholder="Fazit dieses Aufenthalts…"
              className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)] resize-none"
            />
            <p className="mt-1 text-right text-xs text-[var(--c-n400)]">
              {form.review.fazit.length} chars
            </p>
          </div>

          <hr className="border-[var(--c-n100)]" />

          {/* ── Kategorien (unabhängige, optionale Sektionen) ── */}
          <div>
            <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
              Kategorien
            </label>
            <div className="flex flex-col gap-3">
              {REVIEW_CATEGORY_ORDER.map((category) => {
                const cat = form.review.categories[category];
                return (
                  <div key={category} className="rounded-lg border border-[var(--c-n200)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--c-ink)]">
                        {REVIEW_CATEGORY_LABELS[category]}
                      </span>
                      <RatingDots
                        value={cat.rating}
                        min={1}
                        max={5}
                        size={10}
                        onChange={(v) => onCategoryChange(category, { rating: v })}
                      />
                    </div>
                    <input
                      type="text"
                      value={cat.heading}
                      onChange={(e) => onCategoryChange(category, { heading: e.target.value })}
                      placeholder={`Überschrift (optional, Standard: ${REVIEW_CATEGORY_LABELS[category]})`}
                      className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                    />
                    <textarea
                      value={cat.body}
                      onChange={(e) => onCategoryChange(category, { body: e.target.value })}
                      rows={3}
                      placeholder="Text zu dieser Kategorie… (leer lassen zum Ausblenden)"
                      className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)] resize-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bisherige Aufenthalte (read-only) ── */}
          {!isNew && pastReviews.length > 0 && (
            <>
              <hr className="border-[var(--c-n100)]" />
              <div>
                <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
                  Bisherige Aufenthalte
                </label>
                <ul className="space-y-2">
                  {pastReviews.map((rev) => (
                    <li
                      key={rev.id}
                      className="rounded-lg border border-[var(--c-n100)] px-3 py-2 text-xs text-[var(--c-n500)]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[var(--c-n700)]">
                          {new Date(rev.visited_at).toLocaleDateString("de-DE")}
                        </span>
                        <span>{SPOON_RATINGS[rev.spoon_rating].emoji}</span>
                      </div>
                      <p className="line-clamp-2">{rev.fazit || "—"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--c-n100)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name}
            className="flex-1 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : isNew ? "Add Restaurant" : "Save Changes"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({
  restaurants,
  onClose,
  onConfirm,
  deleting,
}: {
  restaurants: Restaurant[];
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (restaurants.length === 0) return null;
  const isBulk = restaurants.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--c-surface)] p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-[var(--c-ink)] mb-1">
          {isBulk ? `${restaurants.length} Restaurants löschen?` : "Delete restaurant?"}
        </h3>
        <p className="text-sm text-[var(--c-n500)] mb-5">
          {isBulk ? (
            <>
              <span className="font-medium text-[var(--c-n700)]">{restaurants.length} Restaurants</span> und
              alle zugehörigen Kommentare werden unwiderruflich gelöscht.
            </>
          ) : (
            <>
              <span className="font-medium text-[var(--c-n700)]">{restaurants[0].name}</span> and all its
              comments will be permanently removed.
            </>
          )}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--c-n200)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)]"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV import modal ──────────────────────────────────────────────────────────

function ImportModal({
  open,
  step,
  parsing,
  importing,
  rows,
  selected,
  bulkSpoonRating,
  onFileSelected,
  onToggleRow,
  onToggleAllNew,
  onBulkSpoonRatingChange,
  onImport,
  onClose,
}: {
  open: boolean;
  step: "pick" | "preview";
  parsing: boolean;
  importing: boolean;
  rows: CsvImportRow[];
  selected: Set<number>;
  bulkSpoonRating: 0 | 1 | 2 | 3;
  onFileSelected: (file: File) => void;
  onToggleRow: (row: number) => void;
  onToggleAllNew: (checked: boolean) => void;
  onBulkSpoonRatingChange: (value: 0 | 1 | 2 | 3) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const newRows = rows.filter((r) => r.match === "new");
  const existingRows = rows.filter((r) => r.match === "existing");
  const allNewSelected = newRows.length > 0 && newRows.every((r) => selected.has(r.row));
  const selectedCount = newRows.filter((r) => selected.has(r.row)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-[var(--c-surface)] shadow-xl">
        <div className="px-6 py-4 border-b border-[var(--c-n100)]">
          <h3 className="font-serif text-lg font-semibold text-[var(--c-ink)]">CSV-Import</h3>
          <p className="text-xs text-[var(--c-n500)] mt-0.5">
            Google-Takeout-Export einer „Gespeicherte Orte“-Liste (Spalten Title/Titel, URL)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "pick" && (
            <div>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--c-n200)] px-4 py-10 text-center cursor-pointer hover:border-[var(--c-gold)] transition-colors">
                <span className="text-sm font-medium text-[var(--c-ink)]">
                  {parsing ? "Wird analysiert…" : "CSV-Datei auswählen"}
                </span>
                <span className="text-xs text-[var(--c-n400)]">.csv aus Google Takeout</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={parsing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileSelected(file);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {newRows.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
                    Spoon-Rating für neue Einträge
                  </label>
                  <p className="text-xs text-[var(--c-n400)] mb-2">
                    Gilt für alle importierten Einträge — praktisch, wenn diese CSV-Liste bereits
                    einer einzigen Bewertungsstufe entspricht (z.B. nur „Worth Mentioning“).
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {SPOON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onBulkSpoonRatingChange(opt.value)}
                        title={opt.label}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          bulkSpoonRating === opt.value
                            ? "border-[var(--c-burg)] bg-[var(--c-burg)] text-white"
                            : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:bg-[var(--c-n50)]"
                        }`}
                      >
                        <span>{opt.emoji}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">
                    Neu ({newRows.length})
                  </label>
                  {newRows.length > 0 && (
                    <button
                      onClick={() => onToggleAllNew(!allNewSelected)}
                      className="text-xs font-medium text-[var(--c-burg)] hover:opacity-80"
                    >
                      {allNewSelected ? "Alle abwählen" : "Alle auswählen"}
                    </button>
                  )}
                </div>
                {newRows.length === 0 ? (
                  <p className="text-sm text-[var(--c-n400)]">Keine neuen Einträge gefunden.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {newRows.map((r) => (
                      <li key={r.row}>
                        <label className="flex items-center gap-2.5 rounded-lg border border-[var(--c-n200)] px-3 py-2 text-sm cursor-pointer hover:bg-[var(--c-n50)]">
                          <input
                            type="checkbox"
                            checked={selected.has(r.row)}
                            onChange={() => onToggleRow(r.row)}
                            className="rounded border-[var(--c-n300)]"
                          />
                          <span className="flex-1 text-[var(--c-ink)] truncate">{r.name}</span>
                          {!r.googlePlaceId && r.mapsUrl && (
                            <a
                              href={r.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-[var(--c-n400)] hover:text-[var(--c-burg)] shrink-0"
                            >
                              Maps ↗
                            </a>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {existingRows.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider mb-1.5">
                    Bereits vorhanden ({existingRows.length})
                  </label>
                  <ul className="space-y-1.5">
                    {existingRows.map((r) => (
                      <li
                        key={r.row}
                        className="flex items-center gap-2.5 rounded-lg border border-[var(--c-n100)] px-3 py-2 text-sm text-[var(--c-n400)]"
                      >
                        <span className="flex-1 truncate">{r.name}</span>
                        <span className="text-xs shrink-0">→ {r.existingName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--c-n100)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)] transition-colors"
          >
            {step === "preview" ? "Abbrechen" : "Schließen"}
          </button>
          {step === "preview" && (
            <button
              onClick={onImport}
              disabled={importing || selectedCount === 0}
              className="flex-1 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? "Importiere…" : `${selectedCount} als Entwurf importieren`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

function PendingRegistrations({
  profiles,
  onDecision,
  busyId,
}: {
  profiles: ProfileWithEmail[];
  onDecision: (id: string, decision: "approve" | "reject") => void;
  busyId: string | null;
}) {
  if (profiles.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--c-gold)]/30 bg-[var(--c-gold-light)]/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--c-gold)]/30">
        <h2 className="text-sm font-semibold text-[var(--c-ink)]">
          Registrierungen ausstehend
        </h2>
        <p className="text-xs text-[var(--c-n500)] mt-0.5">
          {profiles.length} {profiles.length === 1 ? "Konto wartet" : "Konten warten"} auf Freischaltung
        </p>
      </div>
      <ul className="divide-y divide-[var(--c-gold)]/20">
        {profiles.map((p) => (
          <li key={p.id} className="px-4 py-3 flex items-center gap-3">
            <span className="font-medium text-[var(--c-ink)] text-sm">
              {p.email ?? <span className="text-[var(--c-n400)] italic">unbekannte E-Mail</span>}
            </span>
            {p.username && (
              <span className="text-xs text-[var(--c-n400)]">@{p.username}</span>
            )}
            <span className="text-xs text-[var(--c-n400)]">
              seit {new Date(p.created_at).toLocaleDateString("de-DE")}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => onDecision(p.id, "approve")}
                disabled={busyId === p.id}
                className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-success)] hover:bg-[var(--c-success-light)] transition-colors disabled:opacity-50"
              >
                Freischalten
              </button>
              <button
                onClick={() => onDecision(p.id, "reject")}
                disabled={busyId === p.id}
                className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors disabled:opacity-50"
              >
                Ablehnen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── User management (promote/demote/delete) ───────────────────────────────────

type UserActionKind = "promote" | "demote" | "delete";
type UserAction = { profile: ProfileWithEmail; kind: UserActionKind };

const ACTION_COPY: Record<UserActionKind, { title: string; body: string; confirmLabel: string }> = {
  promote: {
    title: "Zum Admin machen?",
    body: "erhält vollen Admin-Zugriff: Restaurants verwalten, Bilder hochladen, Registrierungen freischalten und andere Nutzer verwalten.",
    confirmLabel: "Zum Admin machen",
  },
  demote: {
    title: "Admin-Status entfernen?",
    body: "verliert den Zugriff auf das Admin-Dashboard sofort.",
    confirmLabel: "Admin-Status entfernen",
  },
  delete: {
    title: "Konto endgültig löschen?",
    body: "wird zusammen mit allen Kommentaren unwiderruflich gelöscht. Das kann nicht rückgängig gemacht werden.",
    confirmLabel: "Endgültig löschen",
  },
};

function UserActionModal({
  action,
  step,
  confirmText,
  onConfirmTextChange,
  onContinue,
  onConfirm,
  onCancel,
  busy,
}: {
  action: UserAction | null;
  step: 1 | 2;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  onContinue: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  if (!action) return null;
  const copy = ACTION_COPY[action.kind];
  const identifier = action.profile.email ?? action.profile.username ?? "dieses Konto";
  const matches = confirmText.trim().toLowerCase() === identifier.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--c-surface)] p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-[var(--c-ink)] mb-1">
          {copy.title}
        </h3>

        {step === 1 ? (
          <>
            <p className="text-sm text-[var(--c-n500)] mb-5">
              <span className="font-medium text-[var(--c-n700)]">{identifier}</span> {copy.body}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-[var(--c-n200)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)]"
              >
                Abbrechen
              </button>
              <button
                onClick={onContinue}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white bg-[var(--c-burg)] hover:opacity-90"
              >
                Weiter
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--c-n500)] mb-3">
              Letzte Bestätigung — bitte tippe <span className="font-mono font-medium text-[var(--c-n700)]">{identifier}</span> ein, um fortzufahren.
            </p>
            <input
              autoFocus
              type="text"
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              placeholder={identifier}
              className="w-full mb-4 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
            />
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-[var(--c-n200)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)]"
              >
                Abbrechen
              </button>
              <button
                onClick={onConfirm}
                disabled={!matches || busy}
                className="flex-1 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Wird ausgeführt…" : copy.confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "user" | "admin" }) {
  if (role !== "admin") return null;
  return (
    <span className="text-xs font-medium text-[var(--c-burg)] bg-[var(--c-burg)]/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
      Admin
    </span>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles = {
    pending: "text-[var(--c-gold)] bg-[var(--c-gold-light)]",
    approved: "text-[var(--c-success)] bg-[var(--c-success-light)]",
    rejected: "text-[var(--c-burg)] bg-[var(--c-burg-light)]",
  } as const;
  const labels = { pending: "Ausstehend", approved: "Freigeschaltet", rejected: "Abgelehnt" } as const;
  return (
    <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function UserManagement({
  profiles,
  currentUserId,
  onAction,
}: {
  profiles: ProfileWithEmail[];
  currentUserId: string;
  onAction: (profile: ProfileWithEmail, kind: UserActionKind) => void;
}) {
  return (
    <div className="border-t border-[var(--c-n100)]">
      <ul className="divide-y divide-[var(--c-n50)]">
        {profiles.map((p) => {
          const isSelf = p.id === currentUserId;
          const isPrimaryAdmin = p.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
          return (
            <li key={p.id} className="px-4 py-3 flex items-center gap-3">
              <span className="font-medium text-[var(--c-ink)] text-sm">
                {p.email ?? <span className="text-[var(--c-n400)] italic">unbekannte E-Mail</span>}
              </span>
              {p.username && <span className="text-xs text-[var(--c-n400)]">@{p.username}</span>}
              <RoleBadge role={p.role} />
              <StatusBadge status={p.status} />
              {isSelf && (
                <span className="text-xs text-[var(--c-n400)] italic">(du)</span>
              )}
              {isPrimaryAdmin && (
                <span className="text-xs font-medium text-[var(--c-gold)] bg-[var(--c-gold-light)] rounded px-1.5 py-0.5 uppercase tracking-wider">
                  Haupt-Admin
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {!isSelf && !isPrimaryAdmin && (
                  <>
                    {p.role === "admin" ? (
                      <button
                        onClick={() => onAction(p, "demote")}
                        className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n100)] transition-colors"
                      >
                        Admin-Status entfernen
                      </button>
                    ) : (
                      <button
                        onClick={() => onAction(p, "promote")}
                        className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n100)] transition-colors"
                      >
                        Zum Admin machen
                      </button>
                    )}
                    <button
                      onClick={() => onAction(p, "delete")}
                      className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors"
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminDashboard({
  initialRestaurants,
  initialPendingProfiles,
  initialAllProfiles,
  currentUserId,
  cuisineSuggestions,
}: {
  initialRestaurants: Restaurant[];
  initialPendingProfiles: ProfileWithEmail[];
  initialAllProfiles: ProfileWithEmail[];
  currentUserId: string;
  cuisineSuggestions: string[];
}) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [query, setQuery] = useState("");
  const [draftOnly, setDraftOnly] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [manualEntry, setManualEntry] = useState(false);
  const [visibleContactFields, setVisibleContactFields] = useState<Set<ContactField>>(new Set());
  const [placePhotos, setPlacePhotos] = useState<string[]>([]);
  const [placePhotosLoading, setPlacePhotosLoading] = useState(false);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [pastReviews, setPastReviews] = useState<ReviewWithCategories[]>([]);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<Restaurant[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"pick" | "preview">("pick");
  const [importParsing, setImportParsing] = useState(false);
  const [importImporting, setImportImporting] = useState(false);
  const [importRows, setImportRows] = useState<CsvImportRow[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importBulkSpoonRating, setImportBulkSpoonRating] = useState<0 | 1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const [pendingProfiles, setPendingProfiles] = useState(initialPendingProfiles);
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null);

  function handleRegistrationDecision(id: string, decision: "approve" | "reject") {
    setDecisionBusyId(id);
    startTransition(async () => {
      try {
        if (decision === "approve") {
          await approveProfile(id);
          showToast("Konto freigeschaltet");
        } else {
          await rejectProfile(id);
          showToast("Konto abgelehnt");
        }
        setPendingProfiles((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setDecisionBusyId(null);
      }
    });
  }

  // ── User management (promote/demote/delete, double confirmation) ───────────
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState(initialAllProfiles);
  const [userAction, setUserAction] = useState<UserAction | null>(null);
  const [userActionStep, setUserActionStep] = useState<1 | 2>(1);
  const [userActionConfirmText, setUserActionConfirmText] = useState("");
  const [userActionBusy, setUserActionBusy] = useState(false);

  function openUserAction(profile: ProfileWithEmail, kind: UserActionKind) {
    setUserAction({ profile, kind });
    setUserActionStep(1);
    setUserActionConfirmText("");
  }

  function closeUserAction() {
    setUserAction(null);
    setUserActionStep(1);
    setUserActionConfirmText("");
  }

  function confirmUserAction() {
    if (!userAction) return;
    const { profile, kind } = userAction;
    setUserActionBusy(true);
    startTransition(async () => {
      try {
        if (kind === "promote") {
          await promoteToAdmin(profile.id);
          setAllProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, role: "admin" } : p)));
          showToast("Zum Admin gemacht");
        } else if (kind === "demote") {
          await demoteFromAdmin(profile.id);
          setAllProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, role: "user" } : p)));
          showToast("Admin-Status entfernt");
        } else {
          await deleteUserAccount(profile.id);
          setAllProfiles((prev) => prev.filter((p) => p.id !== profile.id));
          setPendingProfiles((prev) => prev.filter((p) => p.id !== profile.id));
          showToast("Konto gelöscht");
        }
        closeUserAction();
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setUserActionBusy(false);
      }
    });
  }

  const patchForm = useCallback((patch: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchReview = useCallback((patch: Partial<ReviewFormData>) => {
    setForm((prev) => ({ ...prev, review: { ...prev.review, ...patch } }));
  }, []);

  const patchCategory = useCallback(
    (category: ReviewCategory, patch: Partial<CategoryFormData>) => {
      setForm((prev) => ({
        ...prev,
        review: {
          ...prev.review,
          categories: {
            ...prev.review.categories,
            [category]: { ...prev.review.categories[category], ...patch },
          },
        },
      }));
    },
    []
  );

  const handlePlaceSelect = useCallback((place: PlaceSelection) => {
    patchForm({
      name: place.name,
      google_place_id: place.placeId,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      // Best-effort suggestion from Google — the field below stays a free-text
      // input, so the admin can correct/override it right away.
      ...(place.cuisine ? { cuisine: place.cuisine } : {}),
    });
  }, [patchForm]);

  // Vorschau-Fotos aus Google Maps laden, sobald eine Place-ID im Formular steht
  // (frisch ausgewählt oder von einem bereits bestehenden Restaurant geladen).
  // Ohne Place-ID wird beim Rendern (s. placePhotos-Prop unten) einfach nichts
  // angezeigt, statt hier zusätzlich State zurückzusetzen.
  useEffect(() => {
    const placeId = form.google_place_id;
    if (!placeId) return;
    let cancelled = false;
    // Loading-Flag muss synchron vor dem Fetch gesetzt werden, damit die UI
    // sofort "Lade Fotos…" statt kurzzeitig veralteter Fotos zeigt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacePhotosLoading(true);
    getPlaceDetails(placeId)
      .then((details) => {
        if (cancelled) return;
        setPlacePhotos(details.photoUris);
        // Only fill in fields that are still empty — reopening an existing
        // restaurant shouldn't clobber a phone/website the admin already
        // saved/corrected by hand.
        setForm((prev) => ({
          ...prev,
          phone: prev.phone || details.phone || "",
          website: prev.website || details.website || "",
        }));
        setVisibleContactFields((prev) => {
          const next = new Set(prev);
          if (details.phone) next.add("phone");
          if (details.website) next.add("website");
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setPlacePhotos([]);
      })
      .finally(() => {
        if (!cancelled) setPlacePhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.google_place_id]);

  function openNew() {
    setIsNew(true);
    setEditingId(null);
    setCurrentReviewId(null);
    setPastReviews([]);
    setForm(emptyForm());
    setManualEntry(false);
    setVisibleContactFields(new Set());
    setPanelOpen(true);
  }

  async function openEdit(r: Restaurant) {
    setLoadingEditId(r.id);
    try {
      const full = await getRestaurantById(r.id);
      const [latest, ...past] = full.reviews;
      setIsNew(false);
      setEditingId(r.id);
      setCurrentReviewId(latest?.id ?? null);
      setPastReviews(past);
      setForm(formFromRestaurant(r, latest ?? null));
      // Restaurants without a google_place_id were (or need to be) entered
      // manually — default straight to the manual fields in that case.
      setManualEntry(!r.google_place_id);
      // Only show the optional contact fields that already have a value —
      // the admin can still add the others via the toggle chips.
      setVisibleContactFields(
        new Set(
          (["phone", "website", "opening_hours"] as ContactField[]).filter(
            (f) => full[f]
          )
        )
      );
      setPanelOpen(true);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setLoadingEditId(null);
    }
  }

  function toggleContactField(field: ContactField) {
    setVisibleContactFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        // Clear the value too — otherwise a hidden field would still be
        // saved even though the admin just "removed" it from the form.
        patchForm({ [field]: "" });
      } else {
        next.add(field);
      }
      return next;
    });
  }

  function closePanel() {
    setPanelOpen(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function handleSave() {
    const restaurantPayload = {
      name: form.name,
      google_place_id: form.google_place_id || null,
      lat: form.lat,
      lng: form.lng,
      address: form.address || null,
      phone: form.phone || null,
      website: form.website || null,
      opening_hours: form.opening_hours || null,
      cuisine: form.cuisine || null,
      price_level: form.price_level,
      status: form.status,
    };

    const reviewPayload: ReviewPayload = {
      visited_at: form.review.visited_at,
      spoon_rating: form.review.spoon_rating,
      fazit: form.review.fazit,
      categories: form.review.categories,
    };

    startTransition(async () => {
      try {
        if (isNew) {
          const created = await createRestaurant(restaurantPayload, reviewPayload);
          setRestaurants((prev) => [created, ...prev]);
          showToast("Restaurant added");
        } else if (editingId) {
          const updated = await updateRestaurant(editingId, restaurantPayload);
          if (form.review.asNewVisit) {
            await createReview(editingId, reviewPayload);
          } else if (currentReviewId) {
            await updateReview(currentReviewId, editingId, reviewPayload);
          } else {
            await createReview(editingId, reviewPayload);
          }
          setRestaurants((prev) =>
            prev.map((r) =>
              r.id === updated.id ? { ...updated, spoon_rating: reviewPayload.spoon_rating } : r
            )
          );
          showToast("Changes saved");
        }
        closePanel();
      } catch (err) {
        showToast((err as Error).message);
      }
    });
  }

  function handleDelete() {
    if (deleteTargets.length === 0) return;
    const ids = deleteTargets.map((r) => r.id);
    const isBulk = ids.length > 1;
    startTransition(async () => {
      try {
        if (isBulk) {
          await deleteRestaurants(ids);
        } else {
          await deleteRestaurant(ids[0]);
        }
        setRestaurants((prev) => prev.filter((r) => !ids.includes(r.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setDeleteTargets([]);
        showToast(isBulk ? `${ids.length} Restaurants gelöscht` : "Restaurant deleted");
      } catch (err) {
        showToast((err as Error).message);
      }
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openImport() {
    setImportOpen(true);
    setImportStep("pick");
    setImportRows([]);
    setImportSelected(new Set());
    setImportBulkSpoonRating(1);
  }

  function closeImport() {
    setImportOpen(false);
  }

  function handleImportFile(file: File) {
    setImportParsing(true);
    startTransition(async () => {
      try {
        const text = await file.text();
        const rows = await previewCsvImport(text);
        setImportRows(rows);
        setImportSelected(new Set(rows.filter((r) => r.match === "new").map((r) => r.row)));
        setImportStep("preview");
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setImportParsing(false);
      }
    });
  }

  function toggleImportRow(row: number) {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  function toggleAllImportNew(checked: boolean) {
    setImportSelected(
      checked ? new Set(importRows.filter((r) => r.match === "new").map((r) => r.row)) : new Set()
    );
  }

  function handleConfirmImport() {
    const selection = importRows
      .filter((r) => r.match === "new" && importSelected.has(r.row))
      .map((r) => ({ name: r.name, googlePlaceId: r.googlePlaceId, note: r.note }));

    setImportImporting(true);
    startTransition(async () => {
      try {
        const inserted = await confirmCsvImport(selection, importBulkSpoonRating);
        setRestaurants((prev) => [...inserted, ...prev]);
        showToast(`${inserted.length} Restaurants als Entwurf importiert`);
        closeImport();
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setImportImporting(false);
      }
    });
  }

  const filtered = restaurants
    .filter((r) => !draftOnly || r.status === "draft")
    .filter(
      (r) =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        (r.cuisine ?? "").toLowerCase().includes(query.toLowerCase())
    );

  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={["places"]}
    >
      <div className="min-h-screen bg-[var(--c-bg)]">
        {/* No local header here — the global <Header> (app/layout.tsx) already
            renders on every route, including this one; a second admin-only
            header used to render right below it, showing the same site
            branding/theme toggle twice in a row. */}

        {/* ── Page content ── */}
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6">
            <BackButton fallbackHref="/" label="Zurück zur Seite" />
          </div>

          <PendingRegistrations
            profiles={pendingProfiles}
            onDecision={handleRegistrationDecision}
            busyId={decisionBusyId}
          />

          {/* Collapsed by default — could realistically hold 100+ accounts,
              so it shouldn't render fully expanded on every dashboard visit. */}
          <div className="mb-6 rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] overflow-hidden">
            <button
              type="button"
              onClick={() => setUserMgmtOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div>
                <h2 className="text-sm font-semibold text-[var(--c-ink)]">Nutzerverwaltung</h2>
                <p className="text-xs text-[var(--c-n500)] mt-0.5">
                  {allProfiles.length} {allProfiles.length === 1 ? "Konto" : "Konten"} insgesamt
                </p>
              </div>
              <IconChevronDown
                size={16}
                className={`text-[var(--c-n400)] transition-transform ${userMgmtOpen ? "rotate-180" : ""}`}
              />
            </button>
            {userMgmtOpen && (
              <UserManagement
                profiles={allProfiles}
                currentUserId={currentUserId}
                onAction={openUserAction}
              />
            )}
          </div>

          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-[var(--c-ink)]">
                Restaurants
              </h1>
              <p className="text-sm text-[var(--c-n500)] mt-0.5">
                {restaurants.length} {restaurants.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            <div className="sm:ml-auto flex gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-n400)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] pl-8 pr-3 py-2 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 w-48"
                />
              </div>
              <button
                onClick={() => setDraftOnly((v) => !v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  draftOnly
                    ? "border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-ink)]"
                    : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:bg-[var(--c-n50)]"
                }`}
              >
                Nur Entwürfe
              </button>
              <button
                onClick={openImport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-4 py-2 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)] transition-colors"
              >
                CSV-Import
              </button>
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-burg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
                </svg>
                Add new
              </button>
            </div>
          </div>

          {/* ── Bulk-Auswahl-Leiste ── */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--c-burg)]/30 bg-[var(--c-burg-light)] px-4 py-2.5">
              <span className="text-sm font-medium text-[var(--c-ink)]">
                {selectedIds.size} ausgewählt
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-[var(--c-n500)] hover:text-[var(--c-n700)]"
              >
                Auswahl aufheben
              </button>
              <button
                onClick={() =>
                  setDeleteTargets(restaurants.filter((r) => selectedIds.has(r.id)))
                }
                className="ml-auto rounded-lg bg-[var(--c-burg)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-colors"
              >
                Löschen
              </button>
            </div>
          )}

          {/* ── Table ── */}
          <div className="rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-n100)] text-left">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? new Set(filtered.map((r) => r.id)) : new Set()
                        )
                      }
                      className="rounded border-[var(--c-n300)]"
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider hidden md:table-cell">Cuisine</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider hidden lg:table-cell">Place ID</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-n50)]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--c-n400)]">
                      {query ? "No restaurants match your search." : "No restaurants yet. Add one!"}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--c-n50)]/60 transition-colors group">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="rounded border-[var(--c-n300)]"
                        aria-label={`${r.name} auswählen`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/restaurant/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--c-ink)] hover:text-[var(--c-burg)] hover:underline transition-colors"
                        title="Öffentliche Seite in neuem Tab ansehen"
                      >
                        {r.name}
                      </Link>
                      {r.status === "draft" && (
                        <span className="ml-2 text-xs font-medium text-[var(--c-gold)] bg-[var(--c-gold-light)] rounded px-1.5 py-0.5 uppercase tracking-wider align-middle">
                          Entwurf
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--c-n500)] hidden md:table-cell">
                      {r.cuisine ?? <span className="text-[var(--c-n300)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <PriceBadge level={r.price_level} />
                    </td>
                    <td className="px-4 py-3">
                      <SpoonBadge rating={r.spoon_rating} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {r.google_place_id ? (
                        <span className="font-mono text-xs text-[var(--c-n400)] truncate max-w-[160px] block">
                          {r.google_place_id}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--c-gold)] bg-[var(--c-gold-light)] border border-[var(--c-gold)]/30 rounded px-1.5 py-0.5">
                          No place ID
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          disabled={loadingEditId === r.id}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n100)] transition-colors disabled:opacity-50"
                        >
                          {loadingEditId === r.id ? "…" : "Edit"}
                        </button>
                        <button
                          onClick={() => setDeleteTargets([r])}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {/* ── Edit / Create panel ── */}
        <EditPanel
          open={panelOpen}
          isNew={isNew}
          form={form}
          manualEntry={manualEntry}
          onManualEntryToggle={() => setManualEntry((v) => !v)}
          placePhotos={form.google_place_id ? placePhotos : []}
          placePhotosLoading={placePhotosLoading}
          pastReviews={pastReviews}
          cuisineSuggestions={cuisineSuggestions}
          visibleContactFields={visibleContactFields}
          onToggleContactField={toggleContactField}
          onFormChange={patchForm}
          onReviewChange={patchReview}
          onCategoryChange={patchCategory}
          onPlaceSelect={handlePlaceSelect}
          onSave={handleSave}
          onClose={closePanel}
          saving={isPending}
        />

        {/* ── Delete modal ── */}
        <DeleteModal
          restaurants={deleteTargets}
          onClose={() => setDeleteTargets([])}
          onConfirm={handleDelete}
          deleting={isPending}
        />

        {/* ── CSV import modal ── */}
        <ImportModal
          open={importOpen}
          step={importStep}
          parsing={importParsing}
          importing={importImporting}
          rows={importRows}
          selected={importSelected}
          bulkSpoonRating={importBulkSpoonRating}
          onFileSelected={handleImportFile}
          onToggleRow={toggleImportRow}
          onToggleAllNew={toggleAllImportNew}
          onBulkSpoonRatingChange={setImportBulkSpoonRating}
          onImport={handleConfirmImport}
          onClose={closeImport}
        />

        {/* ── User action modal (promote/demote/delete, double confirmation) ── */}
        <UserActionModal
          action={userAction}
          step={userActionStep}
          confirmText={userActionConfirmText}
          onConfirmTextChange={setUserActionConfirmText}
          onContinue={() => setUserActionStep(2)}
          onConfirm={confirmUserAction}
          onCancel={closeUserAction}
          busy={userActionBusy}
        />

        {/* ── Toast ── */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[var(--c-ink)] text-[var(--c-bg)] text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <svg className="w-3.5 h-3.5 text-[var(--c-success)]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {toast}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
