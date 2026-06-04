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
