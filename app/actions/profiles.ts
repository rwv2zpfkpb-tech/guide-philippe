"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createAdminClient } from "@/utils/supabase/admin";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/admin";
import type { Profile } from "@/types/database";

export type ProfileWithEmail = Profile & { email: string | null };

// `profiles` has no email column (lives on auth.users), and `username` is a
// required signup field but not DB-enforced — so we always attach email via
// the service-role client to make sure admins can tell accounts apart.
//
// One listUsers() call instead of one getUserById() per profile — this used
// to fire N parallel admin-API requests (N = every registered account) on
// every admin dashboard load, which doesn't scale as the user base grows
// (per CLAUDE.md, the dashboard already assumes 100+ accounts is plausible).
// perPage=1000 comfortably covers a personal restaurant-guide's user base in
// a single request; revisit with real pagination if that's ever not true.
async function attachEmails(profiles: Profile[]): Promise<ProfileWithEmail[]> {
  if (profiles.length === 0) return [];

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) return profiles.map((p) => ({ ...p, email: null }));

  const emailById = new Map(data.users.map((u) => [u.id, u.email ?? null]));
  return profiles.map((p) => ({ ...p, email: emailById.get(p.id) ?? null }));
}

// ── List accounts awaiting approval (admin-only) ──────────────────────────────

export async function getPendingProfiles(): Promise<ProfileWithEmail[]> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return attachEmails(data ?? []);
}

// ── List every account, for user management (admin-only) ─────────────────────

export async function getAllProfiles(): Promise<ProfileWithEmail[]> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return attachEmails(data ?? []);
}

// ── Approve / reject a registration (admin-only) ──────────────────────────────

async function setProfileStatus(profileId: string, status: "approved" | "rejected") {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .select("id");

  if (error) throw new Error(error.message);
  // RLS silently returns 0 rows instead of an error when a policy blocks the
  // write — without this check a blocked update looks identical to success.
  if (!data || data.length === 0) {
    throw new Error("Update wurde nicht angewendet (RLS-Policy blockiert oder Konto existiert nicht mehr)");
  }

  revalidatePath("/admin/dashboard");
}

export async function approveProfile(profileId: string): Promise<void> {
  await setProfileStatus(profileId, "approved");
}

export async function rejectProfile(profileId: string): Promise<void> {
  await setProfileStatus(profileId, "rejected");
}

// ── Promote / demote / delete accounts (admin-only) ───────────────────────────
// Three safety rails apply to demote/delete:
// - an admin can never target their own account (no accidental self-demotion
//   or self-deletion while sitting in the dashboard)
// - the last remaining admin can never be demoted or deleted, so the app can
//   never end up with zero admins able to reach /admin/dashboard
// - PRIMARY_ADMIN_EMAIL (the hardcoded site-owner account) can never be
//   demoted or deleted by anyone, period — independent of the last-admin
//   count, so it survives even if other admins exist

async function assertNotSelf(profileId: string, currentUserId: string) {
  if (profileId === currentUserId) {
    throw new Error("Diese Aktion kann nicht auf das eigene Konto angewendet werden");
  }
}

async function assertNotPrimaryAdmin(profileId: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient.auth.admin.getUserById(profileId);
  if (data?.user?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`${PRIMARY_ADMIN_EMAIL} ist als Haupt-Admin fest hinterlegt und kann nicht demoted oder gelöscht werden`);
  }
}

async function assertNotLastAdmin(profileId: string, supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) throw new Error(error.message);
  if ((count ?? 0) <= 1) {
    throw new Error("Der letzte verbleibende Admin kann nicht entfernt werden");
  }
}

export async function promoteToAdmin(profileId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  await assertNotSelf(profileId, user.id);

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", profileId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Update wurde nicht angewendet");

  revalidatePath("/admin/dashboard");
}

export async function demoteFromAdmin(profileId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  await assertNotSelf(profileId, user.id);
  await assertNotPrimaryAdmin(profileId);

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .single();
  if (targetError) throw new Error(targetError.message);

  if (target.role === "admin") {
    await assertNotLastAdmin(profileId, supabase);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "user" })
    .eq("id", profileId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Update wurde nicht angewendet");

  revalidatePath("/admin/dashboard");
}

export async function deleteUserAccount(profileId: string): Promise<void> {
  const { user, supabase } = await requireAdmin();
  await assertNotSelf(profileId, user.id);
  await assertNotPrimaryAdmin(profileId);

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .single();
  if (targetError) throw new Error(targetError.message);

  if (target.role === "admin") {
    await assertNotLastAdmin(profileId, supabase);
  }

  // Deleting the auth.users row cascades to profiles and comments (both have
  // `on delete cascade` foreign keys) — the service-role client is required
  // since deleting other users' auth records isn't a regular-client operation.
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/dashboard");
}
