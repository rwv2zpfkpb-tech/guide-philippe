import Link from "next/link";
import { IconWarningTriangle } from "@/components/icons";
import { ConfirmButton } from "./ConfirmButton";

export const metadata = { title: "Konto bestätigen — Guide Philippe" };

// Landing page for the signup confirmation link. The link points here with
// `token_hash`/`type` (see app/api/auth/email/route.ts) instead of GoTrue's
// hosted auto-verify endpoint — verification only happens once the user
// explicitly clicks "Konto bestätigen" below (app/actions/auth.ts:
// confirmEmailToken), not on this page's mere GET load. That's deliberate:
// e-mail security scanners (Outlook Safe Links etc.) fetch links in mails
// automatically to scan them, and a GET-triggered auto-verify would let that
// scan consume the one-time token before the real user ever clicks —
// resulting in "link already expired" on the user's very first click.
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type = "signup" } = await searchParams;

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
        {tokenHash ? (
          <>
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
              E-Mail bestätigen
            </div>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "var(--c-n500)",
                lineHeight: 1.65,
                marginBottom: 28,
              }}
            >
              Klicke auf den Button, um dein Konto bei Guide Philippe zu aktivieren.
            </p>
            <ConfirmButton tokenHash={tokenHash} type={type} />
          </>
        ) : (
          <>
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
              Bestätigung fehlgeschlagen
            </div>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "var(--c-n500)",
                lineHeight: 1.65,
                marginBottom: 28,
              }}
            >
              Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Bestätigungslink an, indem du dich erneut registrierst.
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
          </>
        )}
      </div>
    </main>
  );
}
