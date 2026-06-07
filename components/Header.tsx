import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let profile: { role: string | null; username: string | null } | null = null;
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("profiles")
      .select("role, username")
      .eq("id", user.id)
      .single();
    profile = data;
    isAdmin = profile?.role === "admin";
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "oklch(97.5% 0.008 78 / 0.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid var(--c-n100)",
        boxShadow: "var(--s-sm)",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 40px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--c-ink)",
          }}
        >
          Guide{" "}
          <span style={{ color: "var(--c-burg)" }}>Philippe</span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--c-n500)",
                padding: "7px 14px",
                borderRadius: 6,
                transition: "color 0.15s",
              }}
            >
              Admin
            </Link>
          )}
          {user ? (
            <>
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--c-n500)",
                  padding: "7px 4px",
                }}
              >
                {profile?.username ?? user.email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    padding: "7px 18px",
                    borderRadius: 6,
                    border: "1px solid var(--c-n200)",
                    background: "white",
                    color: "var(--c-ink)",
                    cursor: "pointer",
                  }}
                >
                  Abmelden
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                padding: "7px 18px",
                borderRadius: 6,
                border: "1px solid var(--c-n200)",
                background: "white",
                color: "var(--c-ink)",
                display: "inline-block",
              }}
            >
              Anmelden
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
