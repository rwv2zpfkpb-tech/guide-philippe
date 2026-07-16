import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { IconWarningTriangle } from "@/components/icons";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Passwort zurücksetzen — Guide Philippe" };

// Landing page for both the "forgot password" and the "change password"
// e-mail link (app/actions/auth.ts: requestPasswordReset). GoTrue verifies
// the recovery token itself (hosted /auth/v1/verify endpoint) and redirects
// here with a PKCE `code`, which we exchange for a session — same pattern as
// app/auth/confirm/page.tsx — before letting the user set a new password.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  let success = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    success = !error;
  }

  if (!success) {
    return (
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: `linear-gradient(175deg,
            oklch(90% 0.024 17) 0%,
            oklch(95% 0.014 17) 30%,
            var(--c-bg) 100%)`,
        }}
      >
        <div
          style={{
            background: "var(--c-surface)",
            borderRadius: 22,
            padding: 40,
            maxWidth: 400,
            width: "100%",
            boxShadow: "var(--s-lg)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: "var(--c-burg)" }}>
            <IconWarningTriangle size={40} />
          </div>
          <div
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.75rem",
              fontWeight: 500,
              color: "var(--c-ink)",
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            Link ungültig
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--c-n500)", lineHeight: 1.65, marginBottom: 28 }}>
            Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link zum Zurücksetzen
            deines Passworts an.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--c-n200)",
              background: "var(--c-surface)",
              color: "var(--c-ink)",
            }}
          >
            Zum Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: `linear-gradient(175deg,
          oklch(90% 0.024 17) 0%,
          oklch(95% 0.014 17) 30%,
          var(--c-bg) 100%)`,
      }}
    >
      <ResetPasswordForm />
    </main>
  );
}
