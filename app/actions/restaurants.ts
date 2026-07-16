"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import { createReview, type ReviewPayload } from "@/app/actions/reviews";
import type {
  Restaurant,
  RestaurantWithComments,
  SpoonRating,
  PriceLevel,
  RestaurantStatus,
} from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocationBounds = {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
};

export type RestaurantFilters = {
  cuisine?: string[];
  price_level?: PriceLevel[];
  spoon_rating?: SpoonRating[];
  bounds?: LocationBounds;
  name_search?: string;
};

// image_url removed — served live from Google Places API. address is
// persisted (Places-Autocomplete selection or manual entry) so restaurants
// without a google_place_id (manual fallback) still show an address, and
// the detail page has something to fall back to if the live Places lookup
// fails. spoon_rating/official_review removed — derived from
// restaurant_reviews (the review with the latest visited_at), see
// app/actions/reviews.ts.
export type RestaurantPayload = {
  name: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  cuisine?: string | null;
  price_level?: PriceLevel | null;
  status?: RestaurantStatus;
};

// ── Read actions (no auth required) ──────────────────────────────────────────

export async function getRestaurants(
  filters?: RestaurantFilters
): Promise<Restaurant[]> {
  const supabase = await createClient();

  let query = supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.cuisine?.length) query = query.in("cuisine", filters.cuisine);
  if (filters?.price_level?.length) query = query.in("price_level", filters.price_level);
  if (filters?.spoon_rating?.length) query = query.in("spoon_rating", filters.spoon_rating);
  if (filters?.name_search) {
    query = query.ilike("name", `%${filters.name_search}%`);
  }
  if (filters?.bounds) {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = filters.bounds;
    query = query
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw_lat).lte("lat", ne_lat)
      .gte("lng", sw_lng).lte("lng", ne_lng);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Restaurants added within the last 30 days, newest first — powers the
// "Neu hinzugefügt" strip on the landing page. RLS already hides drafts
// from non-admins, so no explicit status filter is needed here.
export async function getRecentRestaurants(limit = 8): Promise<Restaurant[]> {
  const supabase = await createClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCuisines(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .select("cuisine")
    .not("cuisine", "is", null);

  if (error) throw new Error(error.message);
  return Array.from(new Set(data.map((r) => r.cuisine as string))).sort();
}

export async function getRestaurantById(
  id: string
): Promise<RestaurantWithComments> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .select(
      `
      *,
      comments (
        *,
        profiles ( id, username )
      ),
      reviews:restaurant_reviews (
        *,
        categories:restaurant_review_categories ( * )
      )
    `
    )
    .eq("id", id)
    .order("created_at", { ascending: false, referencedTable: "comments" })
    .single();

  if (error) throw new Error(error.message);

  const restaurant = data as RestaurantWithComments;
  // Sorted client-side rather than via .order({ referencedTable: "restaurant_reviews" }) —
  // PostgREST's referencedTable option is unreliable together with the "reviews:" alias above.
  restaurant.reviews.sort(
    (a, b) => b.visited_at.localeCompare(a.visited_at) || b.created_at.localeCompare(a.created_at)
  );
  return restaurant;
}

// ── Admin mutations ───────────────────────────────────────────────────────────

// Creates the restaurant row and its first review (Aufenthalt) together.
// restaurants.spoon_rating keeps its DB default until the review insert below
// runs, which the sync_restaurant_spoon_rating trigger then corrects.
export async function createRestaurant(
  payload: RestaurantPayload,
  review: ReviewPayload
): Promise<Restaurant> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await createReview(data.id, review);

  revalidatePath("/", "layout");
  return { ...data, spoon_rating: review.spoon_rating };
}

export async function updateRestaurant(
  id: string,
  payload: Partial<RestaurantPayload>
): Promise<Restaurant> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  revalidatePath(`/restaurant/${id}`);
  return data;
}

export async function deleteRestaurant(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("restaurants").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
