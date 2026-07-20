"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

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

// ── E-Mail-Bestätigungslink einlösen (Signup/Invite/E-Mail-Änderung) ────────
// Der Bestätigungslink zeigt seit dem Prefetching-Fix (s. app/api/auth/email/
// route.ts) nicht mehr direkt auf GoTrues Auto-Verify-Endpoint, sondern auf
// unsere eigene /auth/confirm-Seite mit `token_hash`/`type` als Query-Params.
// Diese Action löst den Token erst ein, wenn der Nutzer aktiv auf "Konto
// bestätigen" klickt (Server Action = POST) — E-Mail-Sicherheits-Scanner
// (Outlook Safe Links, Firmen-Gateways etc.), die beim Zustellen der Mail
// automatisch jeden Link per GET aufrufen, verbrauchen den Einmal-Token damit
// nicht mehr, bevor der Nutzer selbst klickt. Grund für den Fix: genau das
// führte dazu, dass der Link schon beim allerersten echten Klick des Nutzers
// als "abgelaufen" gemeldet wurde.

export type ConfirmEmailState = { error: string } | null;

export async function confirmEmailToken(
  _prevState: ConfirmEmailState,
  formData: FormData
): Promise<ConfirmEmailState> {
  const tokenHash = formData.get("token_hash") as string;
  const type = formData.get("type") as EmailOtpType;

  if (!tokenHash || !type) {
    return { error: "Der Link ist ungültig. Bitte fordere einen neuen Bestätigungslink an." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return { error: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Bestätigungslink an, indem du dich erneut registrierst." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ── Password reset (forgot password + logged-in "change password") ──────────
// Both flows funnel through the same Supabase mechanism: an e-mail with a
// recovery link (rendered via lib/auth-emails.ts's "recovery" template,
// delivered through the Send Email Hook) that lands on /auth/reset-password,
// where the user sets a new password. There is no separate "old password"
// form — this is the "reset via e-mail link" pattern the user asked for.

export type RequestPasswordResetState = { error: string } | { success: true } | null;

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData
): Promise<RequestPasswordResetState> {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Bitte gib deine E-Mail-Adresse ein." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  // Always report success regardless of whether the address is registered or
  // the call errored — avoids leaking which e-mails have an account.
  return { success: true };
}

export type UpdatePasswordState = { error: string } | { success: true } | null;

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  // Both "forgot password" and the logged-in "change password" case funnel
  // through the same recovery e-mail link and land on app/auth/reset-
  // password/page.tsx, which always passes the link's token_hash through as
  // a hidden field — so this is normally always set here.
  const tokenHash = formData.get("token_hash") as string | null;

  if (!password || password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }
  if (password !== confirmPassword) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }

  const supabase = await createClient();

  if (tokenHash) {
    // Verified here, on the user's explicit "Passwort speichern"-click,
    // rather than automatically when the recovery link's page loads — see
    // confirmEmailToken above for why (mail-link prescanning consuming the
    // one-time token before the user ever clicks).
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (verifyError) {
      // Token already consumed (e.g. a duplicate submit, or the browser
      // already holds the session from an earlier successful verify on this
      // page) — fall through to updateUser() below only if a session already
      // exists; otherwise this really is an invalid/expired link.
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        return { error: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link zum Zurücksetzen deines Passworts an." };
      }
    }
  }

  // Requires an active session — either just established above via the
  // recovery token, or already present for the logged-in "change password" case.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
