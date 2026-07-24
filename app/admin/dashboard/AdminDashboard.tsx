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
  setFeatured,
  syncGooglePlaceData,
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
import { IconChevronDown, IconStar, IconClock } from "@/components/icons";
import { PlacesAutocomplete, type PlaceSelection } from "@/components/admin/PlacesAutocomplete";
import { CuisineFilterDropdown } from "@/components/CuisineFilterDropdown";
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ── Form state ────────────────────────────────────────────────────────────────

type CategoryFormData = { heading: string; body: string; rating: number | null };

type ReviewFormData = {
  visited_at: string; // yyyy-mm-dd
  // null = noch nicht ausgewählt (nur bei neuen Restaurants möglich — ein
  // bestehendes Restaurant hat immer schon einen Aufenthalt mit konkretem
  // Rating, s. `restaurant_reviews`-Invariante).
  spoon_rating: SpoonRating | null;
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
  google_opening_hours: string[] | null;
  google_synced_at: string | null;
  cuisine: string;
  price_level: PriceLevel | null;
  status: RestaurantStatus;
  review: ReviewFormData;
};

type ContactField = "phone" | "website" | "opening_hours";

// ── Autosave-Entwurf (localStorage) ──────────────────────────────────────────
// Schützt vor Datenverlust bei einem versehentlichen Reload/Schließen des Tabs
// während des Ausfüllens des Edit-Panels (insbesondere lange Fazit-/Kategorie-
// Texte) — kein Server-Roundtrip, rein clientseitig, da dieses Dashboard von
// jeweils einem Admin gleichzeitig benutzt wird (kein Multi-Device-Sync nötig).
type DraftPayload = {
  form: FormData;
  manualEntry: boolean;
  visibleContactFields: ContactField[];
  savedAt: string; // ISO
};

// Ein Entwurf für ein neues Restaurant und einer für die Bearbeitung eines
// bestehenden dürfen sich nie überschreiben — Key trägt deshalb die
// Restaurant-ID (bzw. "new" für den Anlegen-Fall).
function draftStorageKey(editingId: string | null): string {
  return editingId ? `gp-admin-draft-edit-${editingId}` : "gp-admin-draft-new";
}

function loadDraft(key: string): DraftPayload | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

function formatDraftTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Pflichtfelder ─────────────────────────────────────────────────────────────
// "name" ist immer Pflicht (auch für Entwürfe — ein namenloser Datensatz ist
// unsinnig). Die übrigen vier sind nur für den Status "published" Pflicht;
// unvollständige Einträge (z.B. frisch aus dem CSV-Import) bleiben als
// "draft" speicherbar und werden erst beim Veröffentlichen erzwungen.
type RequiredField = "name" | "address" | "price_level" | "spoon_rating" | "fazit";

const REQUIRED_FIELD_LABELS: Record<RequiredField, string> = {
  name: "Name",
  address: "Adresse",
  price_level: "Preis",
  spoon_rating: "Spoon-Rating",
  fazit: "Fazit",
};

function getMissingRequiredFields(form: FormData): Set<RequiredField> {
  const missing = new Set<RequiredField>();
  if (!form.name.trim()) missing.add("name");
  if (!form.address.trim()) missing.add("address");
  if (form.price_level == null) missing.add("price_level");
  if (form.review.spoon_rating == null) missing.add("spoon_rating");
  if (!form.review.fazit.trim()) missing.add("fazit");
  return missing;
}

// ── Fazit-Headline-Vorschau ───────────────────────────────────────────────────
// Muss deckungsgleich mit `ReviewContent` auf der Restaurant-Detailseite
// (app/restaurant/[id]/page.tsx) bleiben: erster Satz (bis zum ersten Punkt)
// wird dort groß als Überschrift gerendert, der Rest als normaler Fließtext.
function splitFazit(fazit: string): { headline: string; rest: string } {
  const trimmed = fazit.trim();
  const firstStop = trimmed.indexOf(".");
  if (firstStop === -1) return { headline: trimmed, rest: "" };
  return { headline: trimmed.slice(0, firstStop + 1), rest: trimmed.slice(firstStop + 1).trim() };
}

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
  google_opening_hours: null,
  google_synced_at: null,
  cuisine: "",
  price_level: null,
  status: "published",
  review: {
    visited_at: todayISO(),
    spoon_rating: null,
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
    google_opening_hours: r.google_opening_hours ?? null,
    google_synced_at: r.google_synced_at ?? null,
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
  hasLiveOpeningHours,
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
  draftBanner,
  onRestoreDraft,
  onDiscardDraft,
}: {
  open: boolean;
  isNew: boolean;
  manualEntry: boolean;
  onManualEntryToggle: () => void;
  placePhotos: string[];
  placePhotosLoading: boolean;
  hasLiveOpeningHours: boolean;
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
  draftBanner: DraftPayload | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
}) {
  const missing = getMissingRequiredFields(form);
  // "name" ist immer Pflicht; die übrigen vier blockieren das Speichern nur,
  // wenn der Eintrag veröffentlicht (nicht als Entwurf) gespeichert wird.
  const saveDisabled =
    saving || missing.has("name") || (form.status === "published" && missing.size > 0);
  const fazitPreview = splitFazit(form.review.fazit);

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
            {isNew ? "Restaurant hinzufügen" : "Restaurant bearbeiten"}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--c-n400)] hover:text-[var(--c-n700)] transition-colors"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Autosave-Entwurf gefunden ── */}
          {draftBanner && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--c-gold-light)", color: "var(--c-ink)" }}
            >
              <span>
                Nicht gespeicherter Entwurf vom {formatDraftTimestamp(draftBanner.savedAt)} gefunden.
              </span>
              <span className="flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onDiscardDraft}
                  className="font-medium text-[var(--c-n500)] hover:opacity-80"
                >
                  Verwerfen
                </button>
                <button
                  type="button"
                  onClick={onRestoreDraft}
                  className="font-medium text-[var(--c-gold)] hover:opacity-80"
                >
                  Wiederherstellen
                </button>
              </span>
            </div>
          )}

          {/* ── Google Places search (or manual fallback) ── */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label
                className={`block text-xs font-medium uppercase tracking-wider ${
                  missing.has("name") || missing.has("address") ? "text-[var(--c-burg)]" : "text-[var(--c-n500)]"
                }`}
              >
                {manualEntry ? "Ort manuell erfassen" : "Auf Google Maps suchen"}
                <span className="ml-1 text-[var(--c-burg)]">*</span>
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
                  className={`w-full rounded-lg border ${
                    missing.has("name") ? "border-[var(--c-burg)]" : "border-[var(--c-n200)]"
                  } bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]`}
                />
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => onFormChange({ address: e.target.value })}
                  placeholder="Adresse (z. B. Musterstraße 1, 12345 Berlin)"
                  className={`w-full rounded-lg border ${
                    missing.has("address") ? "border-[var(--c-burg)]" : "border-[var(--c-n200)]"
                  } bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    value={form.lat ?? ""}
                    onChange={(e) => onFormChange({ lat: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Breitengrad (optional)"
                    className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm font-mono text-[var(--c-ink)] placeholder:text-[var(--c-n400)] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                  />
                  <input
                    type="number"
                    step="any"
                    value={form.lng ?? ""}
                    onChange={(e) => onFormChange({ lng: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Längengrad (optional)"
                    className="w-full rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-3 py-2.5 text-sm font-mono text-[var(--c-ink)] placeholder:text-[var(--c-n400)] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)]"
                  />
                </div>
                <p className="text-xs text-[var(--c-n400)]">
                  Ohne Google-Platz-ID gibt es keine Live-Öffnungszeiten/Fotos auf der Detailseite — nur die hier gespeicherte Adresse. Breitengrad/Längengrad sind nur für die Kartenanzeige nötig.
                </p>
              </div>
            ) : (
              <>
                <PlacesAutocomplete
                  onSelect={onPlaceSelect}
                  defaultValue={form.name}
                  placeholder="Restaurant suchen…"
                />
                {(missing.has("name") || missing.has("address")) && (
                  <p className="mt-1.5 text-xs text-[var(--c-burg)]">
                    Bitte einen Ort auswählen — Name und Adresse sind Pflichtfelder.
                  </p>
                )}
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
                      <div className="mt-1 font-mono text-[var(--c-n400)] truncate" title={form.google_place_id}>
                        Platz-ID: {form.google_place_id}
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
            {!manualEntry && form.google_place_id && !placePhotosLoading && (
              <div
                className={`mb-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  hasLiveOpeningHours
                    ? "border-[var(--c-success)]/30 bg-[var(--c-success-light)]"
                    : "border-[var(--c-n200)] bg-[var(--c-n50)]"
                }`}
              >
                {hasLiveOpeningHours ? (
                  <svg className="w-3.5 h-3.5 mt-0.5 text-[var(--c-success)] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <IconClock size={14} className="mt-0.5 text-[var(--c-n400)] shrink-0" />
                )}
                <span className="text-[var(--c-n600)]">
                  {hasLiveOpeningHours
                    ? "Google liefert Live-Öffnungszeiten für diesen Ort — die Detailseite zeigt sie automatisch, manuelle Eingabe unten ist optional."
                    : "Google liefert für diesen Ort keine Live-Öffnungszeiten — hier manuell eintragen, falls bekannt."}
                </span>
              </div>
            )}
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
            <label
              className={`block text-xs font-medium uppercase tracking-wider mb-1.5 ${
                missing.has("price_level") ? "text-[var(--c-burg)]" : "text-[var(--c-n500)]"
              }`}
            >
              Price Level<span className="ml-1 text-[var(--c-burg)]">*</span>
            </label>
            <div
              className={`flex gap-2 rounded-lg ${
                missing.has("price_level") ? "ring-1 ring-[var(--c-burg)]/60 p-1" : ""
              }`}
            >
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

            <label
              className={`block text-xs mb-1 ${
                missing.has("spoon_rating") ? "text-[var(--c-burg)]" : "text-[var(--c-n500)]"
              }`}
            >
              Spoon-Rating<span className="ml-1 text-[var(--c-burg)]">*</span>
            </label>
            <div
              className={`space-y-2 mb-3 rounded-lg ${
                missing.has("spoon_rating") ? "ring-1 ring-[var(--c-burg)]/60 p-1" : ""
              }`}
            >
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

            <label
              className={`block text-xs mb-1 ${
                missing.has("fazit") ? "text-[var(--c-burg)]" : "text-[var(--c-n500)]"
              }`}
            >
              Fazit<span className="ml-1 text-[var(--c-burg)]">*</span>
            </label>
            <textarea
              value={form.review.fazit}
              onChange={(e) => onReviewChange({ fazit: e.target.value })}
              rows={5}
              placeholder="Fazit dieses Aufenthalts…"
              className={`w-full rounded-lg border ${
                missing.has("fazit") ? "border-[var(--c-burg)]" : "border-[var(--c-n200)]"
              } bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 focus:border-[var(--c-gold)] resize-none`}
            />
            <p className="mt-1.5 text-xs text-[var(--c-n400)]">
              Der erste Satz (bis zum ersten Punkt) erscheint auf der Restaurant-Seite groß als Überschrift, der Rest als normaler Fließtext.
            </p>
            {form.review.fazit.trim() && (
              <div className="mt-2 rounded-lg border border-[var(--c-n100)] bg-[var(--c-n50)] px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--c-n400)] mb-1.5">Vorschau</p>
                <p className="font-serif text-base font-medium leading-tight text-[var(--c-ink)]">
                  {fazitPreview.headline}
                </p>
                {fazitPreview.rest && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--c-n600)]">{fazitPreview.rest}</p>
                )}
              </div>
            )}
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
        <div className="px-6 py-4 border-t border-[var(--c-n100)]">
          {missing.size > 0 && (
            <p className="mb-2 text-xs text-[var(--c-burg)]">
              {missing.has("name")
                ? `Fehlende Pflichtfelder: ${Array.from(missing).map((f) => REQUIRED_FIELD_LABELS[f]).join(", ")}.`
                : form.status === "published"
                ? `Fehlende Pflichtfelder: ${Array.from(missing).map((f) => REQUIRED_FIELD_LABELS[f]).join(", ")} — oder als Entwurf speichern.`
                : `Vor Veröffentlichung noch nötig: ${Array.from(missing).map((f) => REQUIRED_FIELD_LABELS[f]).join(", ")}.`}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)] transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={onSave}
              disabled={saveDisabled}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <span className="gp-spinner-sm" />}
              {saving ? "Speichert…" : isNew ? "Restaurant hinzufügen" : "Änderungen speichern"}
            </button>
          </div>
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
          {isBulk ? `${restaurants.length} Restaurants löschen?` : "Restaurant löschen?"}
        </h3>
        <p className="text-sm text-[var(--c-n500)] mb-5">
          {isBulk ? (
            <>
              <span className="font-medium text-[var(--c-n700)]">{restaurants.length} Restaurants</span> und
              alle zugehörigen Kommentare werden unwiderruflich gelöscht.
            </>
          ) : (
            <>
              <span className="font-medium text-[var(--c-n700)]">{restaurants[0].name}</span> und alle
              zugehörigen Kommentare werden unwiderruflich gelöscht.
            </>
          )}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--c-n200)] py-2.5 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)]"
          >
            Behalten
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting && <span className="gp-spinner-sm" />}
            {deleting ? "Löscht…" : "Ja, löschen"}
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
  syncing,
  rows,
  selected,
  bulkSpoonRating,
  onChooseImport,
  onChooseExport,
  onChooseSync,
  onFileSelected,
  onToggleRow,
  onToggleAllNew,
  onBulkSpoonRatingChange,
  onImport,
  onClose,
}: {
  open: boolean;
  step: "choice" | "pick" | "preview";
  parsing: boolean;
  importing: boolean;
  syncing: boolean;
  rows: CsvImportRow[];
  selected: Set<number>;
  bulkSpoonRating: 0 | 1 | 2 | 3 | null;
  onChooseImport: () => void;
  onChooseExport: () => void;
  onChooseSync: () => void;
  onFileSelected: (file: File) => void;
  onToggleRow: (row: number) => void;
  onToggleAllNew: (checked: boolean) => void;
  onBulkSpoonRatingChange: (value: 0 | 1 | 2 | 3 | null) => void;
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
          <h3 className="font-serif text-lg font-semibold text-[var(--c-ink)]">Erweiterte Funktionen</h3>
          <p className="text-xs text-[var(--c-n500)] mt-0.5">
            {step === "choice"
              ? "Datenbestand importieren, exportieren oder mit Google abgleichen"
              : "Google-Takeout-Export einer „Gespeicherte Orte“-Liste (Spalten Title/Titel, URL)"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "choice" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onChooseImport}
                className="flex flex-col items-start gap-1 rounded-lg border border-[var(--c-n200)] px-4 py-4 text-left hover:border-[var(--c-gold)] hover:bg-[var(--c-n50)] transition-colors"
              >
                <span className="text-sm font-medium text-[var(--c-ink)]">CSV-Import</span>
                <span className="text-xs text-[var(--c-n500)]">
                  Google-Takeout-„Gespeicherte Orte“-Liste einlesen
                </span>
              </button>
              <button
                type="button"
                onClick={onChooseExport}
                className="flex flex-col items-start gap-1 rounded-lg border border-[var(--c-n200)] px-4 py-4 text-left hover:border-[var(--c-gold)] hover:bg-[var(--c-n50)] transition-colors"
              >
                <span className="text-sm font-medium text-[var(--c-ink)]">CSV-Export</span>
                <span className="text-xs text-[var(--c-n500)]">
                  Alle Restaurants als CSV-Datei herunterladen
                </span>
              </button>
              <button
                type="button"
                onClick={onChooseSync}
                disabled={syncing}
                className="flex flex-col items-start gap-1 rounded-lg border border-[var(--c-n200)] px-4 py-4 text-left hover:border-[var(--c-gold)] hover:bg-[var(--c-n50)] transition-colors disabled:opacity-50 sm:col-span-2"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
                  {syncing && <span className="gp-spinner-sm" />}
                  {syncing ? "Synchronisiert…" : "Von Google synchronisieren"}
                </span>
                <span className="text-xs text-[var(--c-n500)]">
                  Adresse/Telefon/Website/Öffnungszeiten für alle Restaurants mit Google-Place-ID neu laden
                </span>
              </button>
            </div>
          )}

          {step === "pick" && (
            <div>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--c-n200)] px-4 py-10 text-center cursor-pointer hover:border-[var(--c-gold)] transition-colors">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--c-ink)]">
                  {parsing && <span className="gp-spinner-sm" />}
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
                    Spoon-Rating für neue Einträge <span className="normal-case font-normal text-[var(--c-n400)]">(optional)</span>
                  </label>
                  <p className="text-xs text-[var(--c-n400)] mb-2">
                    Gilt für alle importierten Einträge — praktisch, wenn diese CSV-Liste bereits
                    einer einzigen Bewertungsstufe entspricht (z.B. nur „Worth Mentioning“). Ohne
                    Auswahl landen die Einträge trotzdem als Entwurf und lassen sich später im
                    Edit-Panel bewerten.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {SPOON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          onBulkSpoonRatingChange(bulkSpoonRating === opt.value ? null : opt.value)
                        }
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
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing && <span className="gp-spinner-sm" />}
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
          <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="font-medium text-[var(--c-ink)] text-sm break-all">
              {p.email ?? <span className="text-[var(--c-n400)] italic">unbekannte E-Mail</span>}
            </span>
            {p.username && (
              <span className="text-xs text-[var(--c-n400)]">@{p.username}</span>
            )}
            <span className="text-xs text-[var(--c-n400)]">
              seit {new Date(p.created_at).toLocaleDateString("de-DE")}
            </span>
            {!p.emailConfirmed && (
              <span
                className="text-xs font-medium text-[var(--c-burg)] bg-[var(--c-burg-light)] rounded px-1.5 py-0.5"
                title="Freischalten ist erst möglich, sobald das Konto seine E-Mail-Adresse über den Bestätigungslink bestätigt hat"
              >
                E-Mail nicht bestätigt
              </span>
            )}
            <div className="ml-auto flex items-center gap-1 flex-wrap">
              <button
                onClick={() => onDecision(p.id, "approve")}
                disabled={busyId === p.id || !p.emailConfirmed}
                title={p.emailConfirmed ? undefined : "Erst möglich, sobald die E-Mail-Adresse bestätigt ist"}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-success)] hover:bg-[var(--c-success-light)] transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {busyId === p.id && <span className="gp-spinner-sm" />}
                Freischalten
              </button>
              <button
                onClick={() => onDecision(p.id, "reject")}
                disabled={busyId === p.id}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors disabled:opacity-50"
              >
                {busyId === p.id && <span className="gp-spinner-sm" />}
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
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-burg)] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {busy && <span className="gp-spinner-sm" />}
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
            <li key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                <span className="font-medium text-[var(--c-ink)] text-sm break-all">
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
              </div>
              <div className="flex items-center gap-1 flex-wrap sm:ml-auto sm:flex-nowrap">
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
  initialFazitById,
  initialPendingProfiles,
  initialAllProfiles,
  currentUserId,
  cuisineSuggestions,
}: {
  initialRestaurants: Restaurant[];
  /** restaurant id -> current review's fazit text — joined in purely so the
   *  search box below can match against it (fazit lives in
   *  restaurant_reviews, not on the restaurant row itself). Not kept in
   *  perfect sync with every edit turned into a full refetch; updated
   *  locally on save instead (s. handleSave). */
  initialFazitById: Record<string, string>;
  initialPendingProfiles: ProfileWithEmail[];
  initialAllProfiles: ProfileWithEmail[];
  currentUserId: string;
  cuisineSuggestions: string[];
}) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [fazitById, setFazitById] = useState(initialFazitById);
  // "Auch Entwürfe in der öffentlichen Suche zeigen" — rein clientseitiger
  // Cookie-Toggle (gleiches Muster wie ThemeToggle.tsx/gp-theme), steuert
  // getRestaurants()/getRecentRestaurants()/getFeaturedRestaurants()/
  // getCuisines() (app/actions/restaurants.ts, SHOW_DRAFTS_COOKIE). Default
  // "aus" für SSR, damit kein Hydration-Mismatch entsteht — der echte Wert
  // ist erst nach dem Mount aus document.cookie bekannt.
  const [showDraftsInSearch, setShowDraftsInSearch] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowDraftsInSearch(document.cookie.includes("gp-show-drafts=1"));
  }, []);
  function toggleShowDraftsInSearch(checked: boolean) {
    setShowDraftsInSearch(checked);
    if (checked) {
      const maxAge = 365 * 24 * 60 * 60; // 1 Jahr
      document.cookie = `gp-show-drafts=1; path=/; max-age=${maxAge}; SameSite=Lax`;
    } else {
      document.cookie = "gp-show-drafts=; path=/; max-age=0";
    }
  }
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [priceFilter, setPriceFilter] = useState<PriceLevel[]>([]);
  const [ratingFilter, setRatingFilter] = useState<SpoonRating[]>([]);
  const [cuisineFilter, setCuisineFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [manualEntry, setManualEntry] = useState(false);
  const [visibleContactFields, setVisibleContactFields] = useState<Set<ContactField>>(new Set());
  // Autosave-Entwurf (s. draftStorageKey oben): "dirty" grenzt tatsächliche
  // Nutzereingaben vom initialen Befüllen des Formulars beim Öffnen ab, damit
  // nicht sofort ein (unveränderter) Entwurf weggeschrieben wird.
  const [dirty, setDirty] = useState(false);
  const [draftBanner, setDraftBanner] = useState<DraftPayload | null>(null);
  const [placePhotos, setPlacePhotos] = useState<string[]>([]);
  const [placePhotosLoading, setPlacePhotosLoading] = useState(false);
  // True once a getPlaceDetails() fetch confirms Google has live opening
  // hours for this place — surfaced as a green-check indicator next to the
  // manual "Öffnungszeiten" field so the admin knows it's a fallback that
  // (for this place) isn't actually needed.
  const [hasLiveOpeningHours, setHasLiveOpeningHours] = useState(false);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [pastReviews, setPastReviews] = useState<ReviewWithCategories[]>([]);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<Restaurant[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"choice" | "pick" | "preview">("choice");
  const [importParsing, setImportParsing] = useState(false);
  const [importImporting, setImportImporting] = useState(false);
  const [importRows, setImportRows] = useState<CsvImportRow[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importBulkSpoonRating, setImportBulkSpoonRating] = useState<0 | 1 | 2 | 3 | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingProfiles, setPendingProfiles] = useState(initialPendingProfiles);
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  function handleSyncGooglePlaceData() {
    setSyncing(true);
    startTransition(async () => {
      try {
        const result = await syncGooglePlaceData();
        setRestaurants((prev) =>
          prev.map((r) => result.restaurants.find((u) => u.id === r.id) ?? r)
        );
        showToast(
          `${result.restaurants.length} von Google aktualisiert` +
            (result.failed ? `, ${result.failed} fehlgeschlagen` : "")
        );
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setSyncing(false);
      }
    });
  }

  // Exports every restaurant currently loaded in this dashboard (all
  // statuses, not just the filtered subset — "gesamte Datenbank") as a CSV
  // download. Built client-side from state already in memory (no extra
  // round-trip): the dashboard already loads every restaurant regardless of
  // status on initial page load (app/admin/dashboard/page.tsx), so there's
  // nothing more to fetch.
  function handleExportCsv() {
    const columns = [
      "name",
      "cuisine",
      "price_level",
      "spoon_rating",
      "status",
      "featured",
      "address",
      "phone",
      "website",
      "opening_hours",
      "fazit",
      "google_place_id",
      "lat",
      "lng",
      "created_at",
    ] as const;

    const escapeCsv = (value: unknown) => {
      const str = value == null ? "" : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const cellValue = (r: (typeof restaurants)[number], col: (typeof columns)[number]) =>
      col === "fazit" ? fazitById[r.id] ?? "" : r[col];

    const rows = restaurants.map((r) => columns.map((col) => escapeCsv(cellValue(r, col))).join(","));
    // Leading BOM so Excel opens the UTF-8 file with umlauts intact.
    const csv = "﻿" + [columns.join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guide-philippe-restaurants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
    setDirty(true);
  }, []);

  const patchReview = useCallback((patch: Partial<ReviewFormData>) => {
    setForm((prev) => ({ ...prev, review: { ...prev.review, ...patch } }));
    setDirty(true);
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
      setDirty(true);
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
    // sofort "Lade Fotos…" statt kurzzeitig veralteter Fotos zeigt. Der
    // Öffnungszeiten-Hinweis unten ist ebenfalls hinter `!placePhotosLoading`
    // versteckt, solange der Fetch läuft — daher muss `hasLiveOpeningHours`
    // hier nicht zusätzlich synchron zurückgesetzt werden.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacePhotosLoading(true);
    getPlaceDetails(placeId)
      .then((details) => {
        if (cancelled) return;
        setPlacePhotos(details.photoUris);
        setHasLiveOpeningHours(details.regularOpeningHours !== null);
        // Only fill in fields that are still empty — reopening an existing
        // restaurant shouldn't clobber a phone/website the admin already
        // saved/corrected by hand. google_opening_hours has no manual edit
        // UI of its own (opening_hours below stays the manual fallback), so
        // it's always refreshed from this response.
        setForm((prev) => ({
          ...prev,
          phone: prev.phone || details.phone || "",
          website: prev.website || details.website || "",
          google_opening_hours: details.regularOpeningHours?.weekdayDescriptions ?? null,
          // Stempel für das 6-Monate-Verfallsdatum (lib/googleSync.ts) — nur
          // bei einem tatsächlich erfolgreichen Fetch gesetzt (dieser
          // .then()-Zweig), damit ein fehlgeschlagener Refresh nicht
          // fälschlich als "gerade synchronisiert" gilt.
          google_synced_at: new Date().toISOString(),
        }));
        setVisibleContactFields((prev) => {
          const next = new Set(prev);
          if (details.phone) next.add("phone");
          if (details.website) next.add("website");
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPlacePhotos([]);
        setHasLiveOpeningHours(false);
      })
      .finally(() => {
        if (!cancelled) setPlacePhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.google_place_id]);

  // Autosave-Entwurf: 1.5s nach der letzten Änderung (debounced, kein Schreiben
  // pro Tastenanschlag) in localStorage sichern — schützt vor Verlust bei
  // versehentlichem Reload/Tab-Schließen. Nur während das Panel offen ist und
  // der Nutzer tatsächlich etwas geändert hat (s. "dirty" oben), sonst würde
  // schon das bloße Öffnen zum Bearbeiten einen "Entwurf" erzeugen.
  useEffect(() => {
    if (!panelOpen || !dirty) return;
    const key = draftStorageKey(editingId);
    const timeout = setTimeout(() => {
      const payload: DraftPayload = {
        form,
        manualEntry,
        visibleContactFields: Array.from(visibleContactFields),
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // Storage voll/deaktiviert (z.B. privater Modus) — Autosave ist ein
        // Komfort-Feature, der eigentliche Speichern-Button bleibt unberührt.
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [form, manualEntry, visibleContactFields, panelOpen, dirty, editingId]);

  function openNew() {
    setIsNew(true);
    setEditingId(null);
    setCurrentReviewId(null);
    setPastReviews([]);
    setForm(emptyForm());
    setManualEntry(false);
    setVisibleContactFields(new Set());
    setDirty(false);
    setDraftBanner(loadDraft(draftStorageKey(null)));
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
      setDirty(false);
      setDraftBanner(loadDraft(draftStorageKey(r.id)));
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
    // Jedes Schließen (Speichern-Erfolg, Abbrechen, Backdrop-Klick, X) ist eine
    // bewusste Entscheidung, das Formular zu verlassen — der Autosave-Entwurf
    // wird dann nicht mehr gebraucht. Nur ein Reload/Tab-Schließen lässt ihn
    // (per Design) in localStorage stehen.
    try {
      localStorage.removeItem(draftStorageKey(editingId));
    } catch {
      // ignore
    }
    setDirty(false);
    setDraftBanner(null);
    setPanelOpen(false);
  }

  function restoreDraft() {
    if (!draftBanner) return;
    setForm(draftBanner.form);
    setManualEntry(draftBanner.manualEntry);
    setVisibleContactFields(new Set(draftBanner.visibleContactFields));
    setDraftBanner(null);
    setDirty(true);
  }

  function discardDraft() {
    try {
      localStorage.removeItem(draftStorageKey(editingId));
    } catch {
      // ignore
    }
    setDraftBanner(null);
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
      google_opening_hours: form.google_opening_hours,
      google_synced_at: form.google_synced_at,
      cuisine: form.cuisine || null,
      price_level: form.price_level,
      status: form.status,
    };

    const reviewPayload: ReviewPayload = {
      visited_at: form.review.visited_at,
      // Entwürfe dürfen ohne explizit gewähltes Spoon-Rating gespeichert
      // werden (Pflichtfeld nur fürs Veröffentlichen, s. `saveDisabled` in
      // EditPanel) — die DB-Spalte ist aber NOT NULL, daher hier derselbe
      // Platzhalter-Fallback wie bei `confirmCsvImport`.
      spoon_rating: form.review.spoon_rating ?? 1,
      fazit: form.review.fazit,
      categories: form.review.categories,
    };

    startTransition(async () => {
      try {
        if (isNew) {
          const result = await createRestaurant(restaurantPayload, reviewPayload);
          if (result.status === "duplicate") {
            try {
              localStorage.removeItem(draftStorageKey(null));
            } catch {
              // ignore
            }
            await openEdit(result.restaurant);
            showToast(
              `„${result.restaurant.name}“ ist bereits vorhanden – vorhandener Eintrag geöffnet`
            );
            return;
          }
          const created = result.restaurant;
          setRestaurants((prev) => [created, ...prev]);
          setFazitById((prev) => ({ ...prev, [created.id]: reviewPayload.fazit }));
          showToast("Restaurant hinzugefügt");
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
          setFazitById((prev) => ({ ...prev, [updated.id]: reviewPayload.fazit }));
          showToast("Änderungen gespeichert");
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
        showToast(isBulk ? `${ids.length} Restaurants gelöscht` : "Restaurant gelöscht");
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

  // Optimistic — flips the local row immediately, rolls back on error, rather
  // than waiting on the round-trip before the star icon changes.
  function handleToggleFeatured(r: Restaurant) {
    const next = !r.featured;
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, featured: next } : x)));
    startTransition(async () => {
      try {
        await setFeatured(r.id, next);
      } catch (err) {
        setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, featured: !next } : x)));
        showToast((err as Error).message);
      }
    });
  }

  function openImport() {
    setImportOpen(true);
    setImportStep("choice");
    setImportRows([]);
    setImportSelected(new Set());
    setImportBulkSpoonRating(null);
  }

  function closeImport() {
    setImportOpen(false);
  }

  function handleChooseImport() {
    setImportStep("pick");
  }

  function handleChooseExport() {
    handleExportCsv();
    closeImport();
  }

  function handleChooseSync() {
    handleSyncGooglePlaceData();
    closeImport();
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
        const inserted = await confirmCsvImport(selection, importBulkSpoonRating ?? undefined);
        setRestaurants((prev) => [...inserted, ...prev]);
        // confirmCsvImport creates one restaurant per `selection` entry, in
        // the same order — zip them back up to seed the fazit search index
        // with the CSV note that became each restaurant's placeholder fazit.
        setFazitById((prev) => {
          const next = { ...prev };
          inserted.forEach((r, i) => {
            if (selection[i]?.note) next[r.id] = selection[i].note!;
          });
          return next;
        });
        showToast(`${inserted.length} Restaurants als Entwurf importiert`);
        closeImport();
      } catch (err) {
        showToast((err as Error).message);
      } finally {
        setImportImporting(false);
      }
    });
  }

  // All cuisines actually present across every restaurant (any status) —
  // deliberately not the `cuisineSuggestions` prop (= getCuisines(), which
  // only looks at *published* restaurants for the public site's filter
  // chips). Most of this admin's 245 entries are drafts, so that list left
  // almost every cuisine value out of the admin filter panel.
  const allCuisines = Array.from(
    new Set(restaurants.map((r) => r.cuisine).filter((c): c is string => !!c))
  ).sort();

  const filtered = restaurants
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => priceFilter.length === 0 || (r.price_level != null && priceFilter.includes(r.price_level)))
    .filter((r) => ratingFilter.length === 0 || ratingFilter.includes(r.spoon_rating))
    .filter((r) => cuisineFilter.length === 0 || (r.cuisine != null && cuisineFilter.includes(r.cuisine)))
    .filter((r) => {
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.cuisine ?? "").toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q) ||
        (fazitById[r.id] ?? "").toLowerCase().includes(q)
      );
    });

  const activeFilterCount = priceFilter.length + ratingFilter.length + cuisineFilter.length;

  function toggleFilterValue<T>(list: T[], setList: (v: T[]) => void, value: T) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setPage(1);
  }

  // `page` can point past the end once a filter/search shrinks `filtered`
  // (e.g. leaving page 5 of a now 2-page list) — clamped here rather than
  // reset via a useEffect, so the table always renders a valid, non-empty
  // page without an extra render pass.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  // Header/"Alle auswählen"-Checkbox wirkt bewusst nur auf die aktuell
  // sichtbare Seite (Standardverhalten paginierter Tabellen, z.B.
  // Gmail/GitHub) — nicht auf alle gefilterten Treffer über alle Seiten
  // hinweg, das wäre beim Anklicken überraschend. Auswahlen auf anderen
  // Seiten bleiben dabei erhalten (Union/Differenz statt Ersetzen).
  function toggleSelectAllOnPage(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageItems.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  }

  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={["places"]}
      language="de"
      region="DE"
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

          {/* ── Entwürfe in der öffentlichen Suche ── Admin-only, explizit
              per Checkbox aktiviert (Default aus), s. SHOW_DRAFTS_COOKIE in
              app/actions/restaurants.ts. Betrifft die normale Website
              (Startseite/Suche/Karte), nicht diese Tabelle hier — die zeigt
              Entwürfe ohnehin schon immer. */}
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--c-ink)]">
                Entwürfe auch in der öffentlichen Suche zeigen
              </p>
              <p className="text-xs text-[var(--c-n500)] mt-0.5">
                Nur für dich als Admin: Entwürfe erscheinen dann zusätzlich zu
                veröffentlichten Einträgen auf der normalen Website (Startseite,
                Suche, Karte), mit „Entwurf“-Badge markiert. Standardmäßig aus.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={showDraftsInSearch}
                onChange={(e) => toggleShowDraftsInSearch(e.target.checked)}
                className="rounded border-[var(--c-n300)]"
              />
              <span className="text-xs font-medium text-[var(--c-n600)]">
                {showDraftsInSearch ? "Aktiv" : "Aus"}
              </span>
            </label>
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
                {filtered.length === restaurants.length
                  ? `${restaurants.length} ${restaurants.length === 1 ? "Eintrag" : "Einträge"}`
                  : `${filtered.length} von ${restaurants.length} Einträgen`}
              </p>
            </div>
            <div className="sm:ml-auto flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={openImport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-4 py-2 text-sm font-medium text-[var(--c-n700)] hover:bg-[var(--c-n50)] transition-colors"
              >
                {syncing && <span className="gp-spinner-sm" />}
                Erweiterte Funktionen
              </button>
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-burg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
                </svg>
                Neu hinzufügen
              </button>
            </div>
          </div>

          {/* ── Filter-Panel (Status/Küche/Preis/Bewertung) — immer sichtbar,
              kein Auf-/Zuklapp-Button mehr (auf Mobile per flex-wrap
              umbrechend statt abgeschnitten). ── */}
          <div className="mb-4 rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--c-n400)] w-20 shrink-0 whitespace-nowrap">
                Suche
              </span>
              <div className="relative w-full sm:w-auto">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-n400)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Name, Küche, Adresse, Fazit…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  className="rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] pl-8 pr-3 py-2 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-n400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40 w-full sm:w-64"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--c-n400)] w-20 shrink-0 whitespace-nowrap">
                Status
              </span>
              {(
                [
                  { value: "all", label: "Alle" },
                  { value: "draft", label: "Nur Entwürfe" },
                  { value: "published", label: "Nur veröffentlicht" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "border-[var(--c-burg)] bg-[var(--c-burg)] text-white"
                      : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:bg-[var(--c-n50)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--c-n400)] w-20 shrink-0 whitespace-nowrap">
                Küche
              </span>
              <CuisineFilterDropdown
                cuisines={allCuisines}
                selected={cuisineFilter}
                onToggle={(c) => toggleFilterValue(cuisineFilter, setCuisineFilter, c)}
                onClear={() => { setCuisineFilter([]); setPage(1); }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--c-n400)] w-20 shrink-0 whitespace-nowrap">
                Preis
              </span>
              {PRICE_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => toggleFilterValue(priceFilter, setPriceFilter, p.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    priceFilter.includes(p.value)
                      ? "border-[var(--c-burg)] bg-[var(--c-burg)] text-white"
                      : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:bg-[var(--c-n50)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--c-n400)] w-20 shrink-0 whitespace-nowrap">
                Bewertung
              </span>
              {SPOON_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleFilterValue(ratingFilter, setRatingFilter, s.value)}
                  title={s.label}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    ratingFilter.includes(s.value)
                      ? "border-[var(--c-burg)] bg-[var(--c-burg)] text-white"
                      : "border-[var(--c-n200)] bg-[var(--c-surface)] text-[var(--c-n600)] hover:bg-[var(--c-n50)]"
                  }`}
                >
                  {s.emoji}
                </button>
              ))}
            </div>
            {(activeFilterCount > 0 || statusFilter !== "all" || query) && (
              <button
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setPage(1);
                  setPriceFilter([]);
                  setRatingFilter([]);
                  setCuisineFilter([]);
                }}
                className="self-start text-xs font-medium text-[var(--c-burg)] hover:underline"
              >
                Filter zurücksetzen
              </button>
            )}
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

          {/* ── Mobile card list (< sm) ── */}
          <div className="sm:hidden space-y-3">
            {pageItems.length > 0 && (
              <label className="flex items-center gap-2 px-1 text-sm text-[var(--c-n500)]">
                <input
                  type="checkbox"
                  checked={pageItems.every((r) => selectedIds.has(r.id))}
                  onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  className="rounded border-[var(--c-n300)]"
                />
                Alle auf dieser Seite auswählen
              </label>
            )}
            {filtered.length === 0 && (
              <p className="rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] px-4 py-10 text-center text-sm text-[var(--c-n400)]">
                {query ? "Keine Restaurants entsprechen deiner Suche." : "Noch keine Restaurants. Füge eins hinzu!"}
              </p>
            )}
            {pageItems.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    aria-label={`${r.name} auswählen`}
                    className="mt-1 rounded border-[var(--c-n300)]"
                  />
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <button
                    onClick={() => handleToggleFeatured(r)}
                    title={r.featured ? "Aus „Auswahl“ entfernen" : "Zur „Auswahl“ hinzufügen"}
                    aria-pressed={r.featured}
                    className={`rounded p-1.5 transition-colors ${
                      r.featured
                        ? "text-[var(--c-gold)] hover:bg-[var(--c-gold-light)]"
                        : "text-[var(--c-n300)] hover:bg-[var(--c-n100)] hover:text-[var(--c-n500)]"
                    }`}
                  >
                    <IconStar size={16} filled={r.featured} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--c-n400)] uppercase tracking-wider">Küche</div>
                    <div className="mt-0.5 text-[var(--c-n600)]">
                      {r.cuisine ?? <span className="text-[var(--c-n300)]">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--c-n400)] uppercase tracking-wider">Preis</div>
                    <div className="mt-0.5">
                      <PriceBadge level={r.price_level} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--c-n400)] uppercase tracking-wider">Bewertung</div>
                    <div className="mt-0.5">
                      <SpoonBadge rating={r.spoon_rating} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-[var(--c-n50)] pt-3">
                  <button
                    onClick={() => openEdit(r)}
                    disabled={loadingEditId === r.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--c-n200)] px-2.5 py-2 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n100)] transition-colors disabled:opacity-50"
                  >
                    {loadingEditId === r.id && <span className="gp-spinner-sm" />}
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => setDeleteTargets([r])}
                    className="flex-1 rounded-lg border border-[var(--c-burg)]/30 px-2.5 py-2 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Table (>= sm) ── */}
          <div className="hidden sm:block rounded-xl border border-[var(--c-n100)] bg-[var(--c-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-n100)] text-left">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && pageItems.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      className="rounded border-[var(--c-n300)]"
                      aria-label="Alle auf dieser Seite auswählen"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider hidden md:table-cell">Küche</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Preis</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--c-n500)] uppercase tracking-wider">Bewertung</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-n50)]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--c-n400)]">
                      {query ? "Keine Restaurants entsprechen deiner Suche." : "Noch keine Restaurants. Füge eins hinzu!"}
                    </td>
                  </tr>
                )}
                {pageItems.map((r) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleFeatured(r)}
                          title={r.featured ? "Aus „Auswahl“ entfernen" : "Zur „Auswahl“ hinzufügen"}
                          aria-pressed={r.featured}
                          className={`rounded p-1.5 transition-colors ${
                            r.featured
                              ? "text-[var(--c-gold)] hover:bg-[var(--c-gold-light)]"
                              : "text-[var(--c-n300)] hover:bg-[var(--c-n100)] hover:text-[var(--c-n500)]"
                          }`}
                        >
                          <IconStar size={16} filled={r.featured} />
                        </button>
                        <button
                          onClick={() => openEdit(r)}
                          disabled={loadingEditId === r.id}
                          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n100)] transition-colors disabled:opacity-50"
                        >
                          {loadingEditId === r.id && <span className="gp-spinner-sm" />}
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => setDeleteTargets([r])}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-[var(--c-burg)] hover:bg-[var(--c-burg-light)] transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination — shared control below both the mobile card list
              and the desktop table (both already render only `pageItems`). ── */}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-[var(--c-n500)]">
              <div className="flex items-center gap-2">
                <label htmlFor="admin-page-size">Pro Seite</label>
                <select
                  id="admin-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-[var(--c-n200)] bg-[var(--c-surface)] px-2 py-1.5 text-sm text-[var(--c-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/40"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="sm:ml-auto flex items-center justify-between sm:justify-end gap-3">
                <span>
                  {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} von {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-[var(--c-n200)] px-3 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n50)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Zurück
                  </button>
                  <span className="px-2 text-xs whitespace-nowrap">
                    Seite {currentPage} von {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                    className="rounded-lg border border-[var(--c-n200)] px-3 py-1.5 text-xs font-medium text-[var(--c-n600)] hover:bg-[var(--c-n50)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Weiter
                  </button>
                </div>
              </div>
            </div>
          )}
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
          hasLiveOpeningHours={hasLiveOpeningHours}
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
          draftBanner={draftBanner}
          onRestoreDraft={restoreDraft}
          onDiscardDraft={discardDraft}
        />

        {/* ── Delete modal ── */}
        <DeleteModal
          restaurants={deleteTargets}
          onClose={() => setDeleteTargets([])}
          onConfirm={handleDelete}
          deleting={isPending}
        />

        {/* ── Extended functions modal (CSV import/export, Google sync) ── */}
        <ImportModal
          open={importOpen}
          step={importStep}
          parsing={importParsing}
          importing={importImporting}
          syncing={syncing}
          rows={importRows}
          selected={importSelected}
          bulkSpoonRating={importBulkSpoonRating}
          onChooseImport={handleChooseImport}
          onChooseExport={handleChooseExport}
          onChooseSync={handleChooseSync}
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
