"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type SignInState = { error: string } | null;
export type SignUpState = { error: string } | { success: true } | null;

// ── Sign in ───────────────────────────────────────────────────────────────────

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

// ── Sign up ───────────────────────────────────────────────────────────────────

export async function signUp(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const supabase = await createClient();

  const email    = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = (formData.get("username") as string)?.trim() || null;

  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Passed to the DB trigger so the profiles row gets the username on creation
      data: { username },
      // Where GoTrue redirects after the confirmation link is clicked —
      // must also be listed under Supabase → Auth → URL Configuration → Redirect URLs
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };

  // Session exists immediately → email confirmation is disabled in Supabase settings
  if (data.session) {
    if (data.user) {
      // Upsert so it works regardless of whether the DB trigger has already
      // created the profiles row. update() silently does nothing on 0 rows.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("profiles")
        .upsert({ id: data.user.id, username: username ?? null })
        .eq("id", data.user.id);
    }
    revalidatePath("/", "layout");
    redirect("/");
  }

  // No session → Supabase sent a confirmation e-mail
  return { success: true };
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
