import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPendingProfiles, getAllProfiles } from "@/app/actions/profiles";
import { getCuisines } from "@/app/actions/restaurants";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = { title: "Admin — Guide Philippe" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Auth + role guard — unauthenticated or non-admin users are redirected
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  // Fetch initial restaurant list — the current review's `fazit` is joined
  // in too (not part of the `restaurants` row itself, s. restaurant_reviews)
  // purely so the admin search box can match against it, s. fazitById below.
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*, reviews:restaurant_reviews(fazit, visited_at, created_at)")
    .order("created_at", { ascending: false });

  const fazitById: Record<string, string> = {};
  for (const r of restaurants ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = (r as any).reviews as { fazit: string; visited_at: string; created_at: string }[] | null;
    if (!reviews?.length) continue;
    const current = [...reviews].sort(
      (a, b) => b.visited_at.localeCompare(a.visited_at) || b.created_at.localeCompare(a.created_at)
    )[0];
    if (current.fazit) fazitById[r.id] = current.fazit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (r as any).reviews;
  }

  const pendingProfiles = await getPendingProfiles();
  const allProfiles = await getAllProfiles();
  const cuisines = await getCuisines();

  return (
    <AdminDashboard
      initialRestaurants={restaurants ?? []}
      initialFazitById={fazitById}
      initialPendingProfiles={pendingProfiles}
      initialAllProfiles={allProfiles}
      currentUserId={user.id}
      cuisineSuggestions={cuisines}
    />
  );
}
