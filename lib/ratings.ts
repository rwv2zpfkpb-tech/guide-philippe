import type { SpoonRating } from "@/types/database";

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
