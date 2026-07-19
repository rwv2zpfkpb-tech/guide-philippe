import { createClient } from "./server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedClient = SupabaseClient<Database>;

export type AuthResult  = { user: NonNullable<Awaited<ReturnType<TypedClient['auth']['getUser']>>['data']['user']>; supabase: TypedClient }

// Throws if the request is not authenticated.
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { user, supabase };
}

// Throws if the caller is not an authenticated admin.
export async function requireAdmin(): Promise<AuthResult> {
  const { user, supabase } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return { user, supabase };
}

// Non-throwing admin check — used where behavior optionally changes for
// admins (e.g. the "auch Entwürfe in der Suche zeigen"-Toggle, s.
// app/actions/restaurants.ts) without gating the whole action behind
// requireAdmin(). Returns false for logged-out users instead of throwing.
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
}

// Throws if the caller is not authenticated AND approved by an admin.
// RLS already enforces this on writes (see comments: approved insert) —
// this just gives callers a clean error message instead of a raw RLS 403.
export async function requireApproved(): Promise<AuthResult> {
  const { user, supabase } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (error || profile?.status !== "approved") {
    throw new Error("Account not yet approved");
  }

  return { user, supabase };
}
