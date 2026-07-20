import Link from "next/link";
import { IconWarningTriangle } from "@/components/icons";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Passwort zurücksetzen — Guide Philippe" };

// Landing page for both the "forgot password" and the "change password"
// e-mail link (app/actions/auth.ts: requestPasswordReset). The link points
// here with a raw `token_hash` (see app/api/auth/email/route.ts) instead of
// GoTrue's hosted auto-verify endpoint — the token is only redeemed once the
// user submits the "set new password" form below (updatePassword in
// app/actions/auth.ts), not on this page's mere GET load. Same reasoning as
// app/auth/confirm/page.tsx: a GET-triggered auto-verify lets e-mail security
// scanners consume the one-time token before the user ever interacts with
// the link, which then reports "expired" on the user's actual first click.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash } = await searchParams;

  if (!tokenHash) {
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
      <ResetPasswordForm tokenHash={tokenHash} />
    </main>
  );
}
