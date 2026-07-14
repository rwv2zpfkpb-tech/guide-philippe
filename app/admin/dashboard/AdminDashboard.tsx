"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { APIProvider } from "@vis.gl/react-google-maps";
import {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} from "@/app/actions/restaurants";
import { PlacesAutocomplete, type PlaceSelection } from "@/components/admin/PlacesAutocomplete";
import { SPOON_RATINGS, SPOON_RATING_ORDER } from "@/lib/ratings";
import type { Restaurant, SpoonRating, PriceLevel } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const CUISINES = [
  "French", "Italian", "Japanese", "Asian", "Mediterranean",
  "American", "Chinese", "Indian", "Spanish", "Middle Eastern",
  "Vietnamese", "Thai", "Greek", "Turkish", "Other",
];

const SPOON_OPTIONS = SPOON_RATING_ORDER.map((value) => ({
  value,
  emoji: SPOON_RATINGS[value].emoji,
  label: SPOON_RATINGS[value].label,
}));

const PRICE_OPTIONS: { value: PriceLevel; label: string }[] = [
  { value: 1, label: "€" },
  { value: 2, label: "€€" },
  { value: 3, label: "€€€" },
  { value: 4, label: "€€€€" },
];

// ── Form state ────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  cuisine: string;
  price_level: PriceLevel | null;
  spoon_rating: SpoonRating;
  official_review: string;
};

const emptyForm = (): FormData => ({
  name: "",
  google_place_id: "",
  lat: null,
  lng: null,
  cuisine: "",
  price_level: null,
  spoon_rating: 3,
  official_review: "",
});

function formFromRestaurant(r: Restaurant): FormData {
  return {
    name: r.name,
    google_place_id: r.google_place_id ?? "",
    lat: r.lat,
    lng: r.lng,
    cuisine: r.cuisine ?? "",
    price_level: r.price_level,
    spoon_rating: r.spoon_rating,
    official_review: r.official_review ?? "",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpoonBadge({ rating }: { rating: SpoonRating }) {
  const opt = SPOON_OPTIONS.find((o) => o.value === rating)!;
  return (
    <span className="text-sm" title={opt.label}>
      {opt.emoji}
    </span>
  );
}

function PriceBadge({ level }: { level: PriceLevel | null }) {
  if (!level) return <span className="text-stone-400">—</span>;
  const full = "€".repeat(level);
  const empty = "€".repeat(4 - level);
  return (
    <span className="font-mono text-xs">
      <span className="text-stone-800">{full}</span>
      <span className="text-stone-300">{empty}</span>
    </span>
  );
}

// ── Edit / Create slide-over ──────────────────────────────────────────────────

function EditPanel({
  open,
  isNew,
  form,
  onFormChange,
  onPlaceSelect,
  onSave,
  onClose,
  saving,
}: {
  open: boolean;
  isNew: boolean;
  form: FormData;
  onFormChange: (patch: Partial<FormData>) => void;
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
        className={`fixed inset-y-0 right-0 z-40 flex flex-col w-full max-w-lg bg-[#faf8f3] shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-serif text-lg font-semibold text-stone-900">
            {isNew ? "Add Restaurant" : "Edit Restaurant"}
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Google Places search ── */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Find on Google Maps
            </label>
            <PlacesAutocomplete
              onSelect={onPlaceSelect}
              defaultValue={form.name}
              placeholder="Search establishment…"
            />
            {form.google_place_id && (
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-stone-700 truncate">{form.name}</span>
                <span className="font-mono text-stone-400 truncate">{form.google_place_id}</span>
              </div>
            )}
          </div>

          {/* ── Coordinates (read-only preview) ── */}
          {(form.lat !== null && form.lng !== null) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Latitude</label>
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-600">{form.lat?.toFixed(6)}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Longitude</label>
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-600">{form.lng?.toFixed(6)}</div>
              </div>
            </div>
          )}

          <hr className="border-stone-100" />

          {/* ── Cuisine ── */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Cuisine
            </label>
            <select
              value={form.cuisine}
              onChange={(e) => onFormChange({ cuisine: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
            >
              <option value="">Select cuisine…</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* ── Price level ── */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
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
                      ? "border-amber-500 bg-amber-50 text-amber-800 font-semibold"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Spoon rating ── */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Spoon Rating
            </label>
            <div className="space-y-2">
              {SPOON_OPTIONS.map(({ value, emoji, label }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    form.spoon_rating === value
                      ? "border-[#4a1520] bg-[#4a1520]/5"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="spoon_rating"
                    value={value}
                    checked={form.spoon_rating === value}
                    onChange={() => onFormChange({ spoon_rating: value })}
                    className="sr-only"
                  />
                  <span className="text-lg">{emoji}</span>
                  <div>
                    <p className={`text-sm font-medium ${form.spoon_rating === value ? "text-[#4a1520]" : "text-stone-800"}`}>
                      {label}
                    </p>
                  </div>
                  {form.spoon_rating === value && (
                    <svg className="ml-auto w-4 h-4 text-[#4a1520]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* ── Official review ── */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
              Editor&rsquo;s Review
            </label>
            <textarea
              value={form.official_review}
              onChange={(e) => onFormChange({ official_review: e.target.value })}
              rows={5}
              placeholder="Write the official editorial review…"
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 resize-none"
            />
            <p className="mt-1 text-right text-xs text-stone-400">
              {form.official_review.length} chars
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name}
            className="flex-1 rounded-lg bg-[#4a1520] py-2.5 text-sm font-medium text-white hover:bg-[#5e1c28] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  restaurant,
  onClose,
  onConfirm,
  deleting,
}: {
  restaurant: Restaurant | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!restaurant) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-stone-900 mb-1">
          Delete restaurant?
        </h3>
        <p className="text-sm text-stone-500 mb-5">
          <span className="font-medium text-stone-700">{restaurant.name}</span> and all its
          comments will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function AdminDashboard({
  initialRestaurants,
}: {
  initialRestaurants: Restaurant[];
}) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const patchForm = useCallback((patch: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handlePlaceSelect = useCallback((place: PlaceSelection) => {
    patchForm({
      name: place.name,
      google_place_id: place.placeId,
      lat: place.lat,
      lng: place.lng,
    });
  }, [patchForm]);

  function openNew() {
    setIsNew(true);
    setEditingId(null);
    setForm(emptyForm());
    setPanelOpen(true);
  }

  function openEdit(r: Restaurant) {
    setIsNew(false);
    setEditingId(r.id);
    setForm(formFromRestaurant(r));
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      google_place_id: form.google_place_id || null,
      lat: form.lat,
      lng: form.lng,
      cuisine: form.cuisine || null,
      price_level: form.price_level,
      spoon_rating: form.spoon_rating,
      official_review: form.official_review || null,
    };

    startTransition(async () => {
      try {
        if (isNew) {
          const created = await createRestaurant(payload);
          setRestaurants((prev) => [created, ...prev]);
          showToast("Restaurant added");
        } else if (editingId) {
          const updated = await updateRestaurant(editingId, payload);
          setRestaurants((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
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
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      try {
        await deleteRestaurant(id);
        setRestaurants((prev) => prev.filter((r) => r.id !== id));
        setDeleteTarget(null);
        showToast("Restaurant deleted");
      } catch (err) {
        showToast((err as Error).message);
      }
    });
  }

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.cuisine ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={["places"]}
    >
      <div className="min-h-screen bg-[#faf8f3]">
        {/* ── Header ── */}
        <header className="sticky top-0 z-20 border-b border-stone-100 bg-[#faf8f3]/95 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 h-14 flex items-center gap-4">
            <span className="font-serif text-lg font-semibold text-stone-900">
              Guide <span style={{ color: "#4a1520" }}>Philippe</span>
            </span>
            <span className="text-xs font-medium text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
              Admin
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/"
                className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
              >
                ← Public site
              </Link>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-stone-900">
                Restaurants
              </h1>
              <p className="text-sm text-stone-500 mt-0.5">
                {restaurants.length} {restaurants.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            <div className="sm:ml-auto flex gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-white pl-8 pr-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-48"
                />
              </div>
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4a1520] px-4 py-2 text-sm font-medium text-white hover:bg-[#5e1c28] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z" />
                </svg>
                Add new
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="rounded-xl border border-stone-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider hidden md:table-cell">Cuisine</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider hidden lg:table-cell">Place ID</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400">
                      {query ? "No restaurants match your search." : "No restaurants yet. Add one!"}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900">{r.name}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                      {r.cuisine ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <PriceBadge level={r.price_level} />
                    </td>
                    <td className="px-4 py-3">
                      <SpoonBadge rating={r.spoon_rating} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {r.google_place_id ? (
                        <span className="font-mono text-xs text-stone-400 truncate max-w-[160px] block">
                          {r.google_place_id}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                          No place ID
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
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
          onFormChange={patchForm}
          onPlaceSelect={handlePlaceSelect}
          onSave={handleSave}
          onClose={closePanel}
          saving={isPending}
        />

        {/* ── Delete modal ── */}
        <DeleteModal
          restaurant={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={isPending}
        />

        {/* ── Toast ── */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-stone-900 text-white text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {toast}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
