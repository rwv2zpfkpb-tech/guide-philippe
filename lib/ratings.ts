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
