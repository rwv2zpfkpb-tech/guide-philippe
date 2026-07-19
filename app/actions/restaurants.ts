"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdmin, isCurrentUserAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import { createReview, type ReviewPayload } from "@/app/actions/reviews";
import { getPlaceDetails } from "@/app/actions/places";
import { createAdminClient } from "@/utils/supabase/admin";
import { isGoogleDataStale } from "@/lib/googleSync";
import type {
  Restaurant,
  RestaurantWithComments,
  SpoonRating,
  PriceLevel,
  RestaurantStatus,
} from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RestaurantFilters = {
  cuisine?: string[];
  price_level?: PriceLevel[];
  spoon_rating?: SpoonRating[];
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
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  google_opening_hours?: string[] | null;
  google_synced_at?: string | null;
  cuisine?: string | null;
  price_level?: PriceLevel | null;
  status?: RestaurantStatus;
  featured?: boolean;
};

// ── Read actions (no auth required) ──────────────────────────────────────────

// "Auch Entwürfe in der Suche zeigen"-Toggle (AdminDashboard, s.
// SHOW_DRAFTS_COOKIE unten): standardmäßig aus, muss ein Admin explizit per
// Checkbox aktivieren (Cookie, gleiches Client-seitiges Muster wie
// ThemeToggle.tsx/gp-theme). Der Cookie-Wert allein reicht aber nie aus —
// die Rolle wird hier zusätzlich serverseitig gegen die DB geprüft, damit
// ein manuell gesetzter Cookie (z.B. per DevTools) bei einem Nicht-Admin
// wirkungslos bleibt.
// Cookie name kept here as a plain constant, not exported: a "use server"
// file may only export async functions (Next.js Server Actions
// restriction) — a `const` export breaks the build. The name only needs to
// match ThemeToggle.tsx-style client code (AdminDashboard.tsx), which sets
// it directly as a string literal.
const SHOW_DRAFTS_COOKIE = "gp-show-drafts";

async function shouldIncludeDrafts(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(SHOW_DRAFTS_COOKIE)?.value !== "1") return false;
  return isCurrentUserAdmin();
}

export async function getRestaurants(
  filters?: RestaurantFilters
): Promise<Restaurant[]> {
  const supabase = await createClient();
  const includeDrafts = await shouldIncludeDrafts();

  // Explicit filter rather than relying on RLS alone: RLS only hides drafts
  // from non-admins, so an admin browsing the normal site (not the admin
  // dashboard, which queries restaurants directly) would otherwise see
  // draft entries mixed into public search/grid results — unless the admin
  // has explicitly opted into exactly that via the toggle above.
  let query = supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");

  if (filters?.cuisine?.length) query = query.in("cuisine", filters.cuisine);
  if (filters?.price_level?.length) query = query.in("price_level", filters.price_level);
  if (filters?.spoon_rating?.length) query = query.in("spoon_rating", filters.spoon_rating);
  if (filters?.name_search) {
    query = query.ilike("name", `%${filters.name_search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// The N newest restaurants, newest first — powers the "Neu hinzugefügt"
// strip on the landing page. Simply the most recently added entries (no
// 30-day cutoff — a small/inactive guide would otherwise show an empty or
// near-empty strip for months). Drafts are excluded explicitly (not just
// via RLS) — see getRestaurants() above for why.
export async function getRecentRestaurants(limit = 6): Promise<Restaurant[]> {
  const supabase = await createClient();
  const includeDrafts = await shouldIncludeDrafts();

  let query = supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!includeDrafts) query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Handverlesene "Auswahl"-Reihe auf der Landing-Page — unabhängig von
// "Neu hinzugefügt" (zeitbasiert), Admins schalten restaurants.featured
// gezielt frei (s. setFeatured unten). Entwürfe werden explizit ausgefiltert
// (nicht nur per RLS) — s. getRestaurants() oben.
export async function getFeaturedRestaurants(): Promise<Restaurant[]> {
  const supabase = await createClient();
  const includeDrafts = await shouldIncludeDrafts();

  let query = supabase
    .from("restaurants")
    .select("*")
    .eq("featured", true)
    .order("name", { ascending: true });
  if (!includeDrafts) query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCuisines(): Promise<string[]> {
  const supabase = await createClient();
  const includeDrafts = await shouldIncludeDrafts();

  let query = supabase
    .from("restaurants")
    .select("cuisine")
    .not("cuisine", "is", null);
  if (!includeDrafts) query = query.eq("status", "published");

  const { data, error } = await query;
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

// Adresse/Telefon/Website/Öffnungszeiten werden nicht mehr live bei jedem
// öffentlichen Seitenaufruf von Google geladen (s. Restaurant-Detailseite/
// SearchResultsView), sondern aus der DB gelesen — befüllt wird nur noch,
// wenn ein Admin aktiv mit Google interagiert (Autocomplete-Auswahl,
// CSV-Import, oder dieser Bulk-Sync). Holt für jedes Restaurant mit
// google_place_id per getPlaceDetails() den aktuellen Stand nach: Adresse/
// Telefon/Website nur, wenn das Feld noch leer ist (schützt manuelle
// Korrekturen — gleiches Muster wie der Admin-Edit-Panel-Effekt), die rein
// Google-abgeleiteten google_opening_hours werden immer überschrieben.
// Sequenziell statt Promise.all, um Google nicht zu bursten (gleiches Muster
// wie confirmCsvImport); ein einzelner fehlgeschlagener Lookup bricht den
// Lauf nicht ab.
export async function syncGooglePlaceData(): Promise<{ restaurants: Restaurant[]; failed: number }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("restaurants")
    .select("*")
    .not("google_place_id", "is", null);
  if (error) throw new Error(error.message);

  const updated: Restaurant[] = [];
  let failed = 0;

  for (const r of rows ?? []) {
    try {
      const details = await getPlaceDetails(r.google_place_id!);
      const patch: Partial<RestaurantPayload> = {
        address: r.address || details.formattedAddress || null,
        phone: r.phone || details.phone || null,
        website: r.website || details.website || null,
        google_opening_hours: details.regularOpeningHours?.weekdayDescriptions ?? null,
        google_synced_at: new Date().toISOString(),
      };
      const { data, error: updateError } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", r.id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      updated.push(data);
    } catch {
      failed++;
    }
  }

  revalidatePath("/", "layout");
  return { restaurants: updated, failed };
}

// Automatisches Verfallsdatum für die per syncGooglePlaceData()/Admin-Panel/
// CSV-Import persistierten Google-Daten: läuft für jeden Besucher der
// Restaurant-Detailseite (nicht nur Admins — die ganze App ist ohnehin
// login-pflichtig, s. proxy.ts), aber nur ein No-op, solange
// google_synced_at jünger als GOOGLE_DATA_STALE_DAYS ist (lib/googleSync.ts,
// ~6 Monate).
//
// SICHERHEIT: nimmt bewusst nur die `restaurantId` entgegen und lädt
// Restaurant **und** Google-Daten selbst server-seitig neu, statt (wie
// zuvor) `restaurant`/`details`-Objekte vom Aufrufer zu übernehmen. Jede
// exportierte Funktion in einer "use server"-Datei ist ein öffentlicher
// HTTP-Endpunkt, unabhängig davon, ob sie je von Client-Code referenziert
// wird (Next.js registriert sie serverseitig trotzdem) — ein Client hätte
// hier sonst beliebige `restaurant`/`details`-Felder (Adresse/Telefon/
// Website/Öffnungszeiten, sogar für eine fremde `restaurant.id`) mitgeben
// und über den Service-Role-Client (RLS-Bypass!) in eine beliebige
// restaurants-Zeile schreiben können, ganz ohne Admin-Rechte. Mit der
// Restaurant-Zeile aus einem eigenen (RLS-gebundenen) SELECT und einem
// eigenen `getPlaceDetails()`-Aufruf ist der einzige vom Aufrufer
// kontrollierte Input die `restaurantId` selbst — das schlimmste, was sich
// damit auslösen lässt, ist ein vorgezogener, aber inhaltlich echter
// Google-Sync für ein einzelnes (für den Aufrufer laut RLS sichtbares)
// Restaurant. Verursacht dadurch im Stale-Fall einen zusätzlichen
// Places-Request (statt den ohnehin schon für die Fotos geladenen
// wiederzuverwenden) — im Normalfall (nicht abgelaufen) bleibt es aber ein
// reiner No-op ohne jeden zusätzlichen Request.
export async function refreshGooglePlaceDataIfStale(
  restaurantId: string
): Promise<Restaurant | null> {
  const supabase = await createClient();
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();
  if (error || !restaurant) return null;

  if (!restaurant.google_place_id) return restaurant;
  if (!isGoogleDataStale(restaurant.google_synced_at)) return restaurant;

  const details = await getPlaceDetails(restaurant.google_place_id).catch(() => null);
  if (!details) return restaurant;

  const patch: Partial<RestaurantPayload> = {
    address: restaurant.address || details.formattedAddress || null,
    phone: restaurant.phone || details.phone || null,
    website: restaurant.website || details.website || null,
    google_opening_hours: details.regularOpeningHours?.weekdayDescriptions ?? null,
    google_synced_at: new Date().toISOString(),
  };

  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from("restaurants")
    .update(patch)
    .eq("id", restaurant.id);
  if (updateError) return restaurant;

  return { ...restaurant, ...patch };
}

// Quick-Toggle für die Tabelle im Admin-Dashboard (Stern-Icon je Zeile) —
// eigene Action statt über updateRestaurant, damit ein Klick nicht das
// komplette Edit-Panel-Formular voraussetzt.
export async function setFeatured(id: string, featured: boolean): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("restaurants").update({ featured }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteRestaurant(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("restaurants").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Bulk-Löschen für die Mehrfachauswahl im Admin-Dashboard — ein Request statt
// einer Schleife aus Einzel-deleteRestaurant-Aufrufen.
export async function deleteRestaurants(ids: string[]): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("restaurants").delete().in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
