import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Konto wird geprüft — Guide Philippe" };

// Landing page for accounts that are logged in but not yet approved by an
// admin (profiles.status = 'pending' or 'rejected'). proxy.ts redirects here
// for every route until an admin flips the status to 'approved'.
export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status === "approved") redirect("/");

  const rejected = profile?.status === "rejected";

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
          {rejected ? "🚫" : "⏳"}
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
          {rejected ? "Zugang abgelehnt" : "Konto wird geprüft"}
        </div>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--c-n500)",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          {rejected
            ? "Ein Admin hat diese Registrierung abgelehnt. Bei Fragen wende dich bitte direkt an einen Admin."
            : "Deine E-Mail ist bestätigt. Ein Admin muss dein Konto noch freischalten, bevor du Guide Philippe nutzen kannst."}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--c-n200)",
              background: "var(--c-surface)",
              color: "var(--c-ink)",
              cursor: "pointer",
            }}
          >
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
