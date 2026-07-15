import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "E-Mail bestätigt — Guide Philippe" };

// Landing page for the signup confirmation link: GoTrue verifies the token_hash
// itself (hosted /auth/v1/verify endpoint) and redirects here with a PKCE
// `code`, which we exchange for a session so the user ends up logged in.
export default async function ConfirmEmailPage({
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
        <div style={{ fontSize: "2.5rem", marginBottom: 20 }}>
          {success ? "✅" : "⚠️"}
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
          {success ? "E-Mail bestätigt" : "Bestätigung fehlgeschlagen"}
        </div>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--c-n500)",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          {success
            ? "Dein Konto ist aktiviert und du bist angemeldet. Viel Spaß bei Guide Philippe!"
            : "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Bestätigungslink an, indem du dich erneut registrierst."}
        </p>
        <Link
          href={success ? "/" : "/login"}
          style={{
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            borderRadius: 8,
            border: success ? "none" : "1px solid var(--c-n200)",
            background: success ? "var(--c-ink)" : "var(--c-surface)",
            color: success ? "var(--c-bg)" : "var(--c-ink)",
          }}
        >
          {success ? "Zur Startseite" : "Zum Login"}
        </Link>
      </div>
    </main>
  );
}
