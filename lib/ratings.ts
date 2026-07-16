import type { SpoonRating, ReviewCategory } from "@/types/database";

// Single source of truth for spoon-rating emoji/labels.
// Previously duplicated across RestaurantCard, the restaurant detail page,
// SearchResultsView, MapView, FilterBar, and AdminDashboard.
export const SPOON_RATINGS: Record<
  SpoonRating,
  { emoji: string; label: string; labelShort: string }
> = {
  3: { emoji: "🍽️", label: "Absolute Recommendation", labelShort: "Absolute rec." },
  2: { emoji: "🍴", label: "Worth Mentioning", labelShort: "Worth mentioning" },
  1: { emoji: "🥄", label: "Remembering", labelShort: "Remembering" },
  0: { emoji: "🫗", label: "Not Recommended", labelShort: "Not recommended" },
};

// Best-to-worst — the order ratings should appear in selects, filters, and legends.
export const SPOON_RATING_ORDER: SpoonRating[] = [3, 2, 1, 0];

// Consistent color coding for the spoon rating, reusing the app's existing
// brand tokens (never bespoke hex) so it stays correct in dark mode too:
// best → gold, second-best → lilac, "remembering" → mauve, worst → grey.
// Used everywhere a spoon rating is shown (cards, list rows, detail page
// verdict box, admin badges, map markers) so the same rating always reads
// the same way across the app.
export const SPOON_RATING_COLORS: Record<
  SpoonRating,
  { text: string; bg: string; border: string }
> = {
  3: { text: "var(--c-gold)", bg: "var(--c-gold-light)", border: "var(--c-gold)" },
  2: { text: "var(--c-lilac)", bg: "var(--c-lilac-light)", border: "var(--c-lilac)" },
  1: { text: "var(--c-mauve)", bg: "var(--c-mauve-light)", border: "var(--c-mauve)" },
  0: { text: "var(--c-n500)", bg: "var(--c-n100)", border: "var(--c-n300)" },
};

// ── Editorial review categories ─────────────────────────────────────────────
// Single source of truth for the 4 fixed sub-categories a restaurant review
// can optionally break down into (each 0–5, rendered with RatingDots).
export const REVIEW_CATEGORY_ORDER: ReviewCategory[] = [
  "service",
  "location",
  "geschmack",
  "preis_leistung",
];

export const REVIEW_CATEGORY_LABELS: Record<ReviewCategory, string> = {
  service: "Service",
  location: "Location",
  geschmack: "Geschmack",
  preis_leistung: "Preis-Leistung",
};

// ── User star ratings ────────────────────────────────────────────────────────
// Average of comments.secondary_rating (0–5), used for the half-star display
// next to the "Reader Experiences" heading. Returns null when there are no
// rated comments yet.
export function computeAverageRating(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}
