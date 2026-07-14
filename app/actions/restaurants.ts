"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import type {
  Restaurant,
  RestaurantWithComments,
  SpoonRating,
  PriceLevel,
} from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocationBounds = {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
};

export type RestaurantFilters = {
  cuisine?: string;
  price_level?: PriceLevel;
  spoon_rating?: SpoonRating;
  bounds?: LocationBounds;
  name_search?: string;
};

// address and image_url removed — served live from Google Places API
export type RestaurantPayload = {
  name: string;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  cuisine?: string | null;
  price_level?: PriceLevel | null;
  spoon_rating?: SpoonRating;
  official_review?: string | null;
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

  if (filters?.cuisine) query = query.eq("cuisine", filters.cuisine);
  if (filters?.price_level) query = query.eq("price_level", filters.price_level);
  if (filters?.spoon_rating !== undefined) {
    query = query.eq("spoon_rating", filters.spoon_rating);
  }
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
      )
    `
    )
    .eq("id", id)
    .order("created_at", { ascending: false, referencedTable: "comments" })
    .single();

  if (error) throw new Error(error.message);
  return data as RestaurantWithComments;
}

// ── Admin mutations ───────────────────────────────────────────────────────────

export async function createRestaurant(
  payload: RestaurantPayload
): Promise<Restaurant> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return data;
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
