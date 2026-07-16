"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import { REVIEW_CATEGORY_ORDER } from "@/lib/ratings";
import type { RestaurantReview, ReviewCategory, SpoonRating } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReviewCategoryPayload = {
  heading: string;
  body: string;
  rating: number | null; // 0–5
};

export type ReviewPayload = {
  visited_at: string; // yyyy-mm-dd
  spoon_rating: SpoonRating;
  fazit: string;
  categories: Partial<Record<ReviewCategory, ReviewCategoryPayload>>;
};

// Every review always gets a row for all 4 fixed categories (possibly blank) —
// keeps createReview/updateReview symmetric via a single upsert/insert call.
function categoryRows(reviewId: string, categories: ReviewPayload["categories"]) {
  return REVIEW_CATEGORY_ORDER.map((category) => {
    const c = categories[category];
    return {
      review_id: reviewId,
      category,
      heading: c?.heading || null,
      body: c?.body || null,
      rating: c?.rating ?? null,
    };
  });
}

// ── Create a new review (a restaurant's first review, or a new "Aufenthalt") ──

export async function createReview(
  restaurantId: string,
  payload: ReviewPayload
): Promise<RestaurantReview> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: review, error } = await supabase
    .from("restaurant_reviews")
    .insert({
      restaurant_id: restaurantId,
      visited_at: payload.visited_at,
      spoon_rating: payload.spoon_rating,
      fazit: payload.fazit,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: catError } = await supabase
    .from("restaurant_review_categories")
    .insert(categoryRows(review.id, payload.categories));

  if (catError) throw new Error(catError.message);

  revalidatePath("/", "layout");
  revalidatePath(`/restaurant/${restaurantId}`);
  return review;
}

// ── Update an existing review in place (correcting the current Aufenthalt) ───

export async function updateReview(
  reviewId: string,
  restaurantId: string,
  payload: ReviewPayload
): Promise<RestaurantReview> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: review, error } = await supabase
    .from("restaurant_reviews")
    .update({
      visited_at: payload.visited_at,
      spoon_rating: payload.spoon_rating,
      fazit: payload.fazit,
    })
    .eq("id", reviewId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: catError } = await supabase
    .from("restaurant_review_categories")
    .upsert(categoryRows(reviewId, payload.categories), { onConflict: "review_id,category" });

  if (catError) throw new Error(catError.message);

  revalidatePath("/", "layout");
  revalidatePath(`/restaurant/${restaurantId}`);
  return review;
}
