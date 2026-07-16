import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPendingProfiles, getAllProfiles } from "@/app/actions/profiles";
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

  // Fetch initial restaurant list
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  const pendingProfiles = await getPendingProfiles();
  const allProfiles = await getAllProfiles();

  return (
    <AdminDashboard
      initialRestaurants={restaurants ?? []}
      initialPendingProfiles={pendingProfiles}
      initialAllProfiles={allProfiles}
      currentUserId={user.id}
    />
  );
}
