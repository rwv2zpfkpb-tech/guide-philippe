"use client";

// Precached by public/sw.js and served for any navigation that fails while
// truly offline (see sw.js's fetch handler) — the service worker returns
// this page straight from its cache without a network round trip, so it
// never goes through proxy.ts. Kept as plain static content (no data
// fetching) since it must render with zero network access. Public path
// (utils/supabase/proxy.ts PUBLIC_PATHS) in case it's ever hit directly.
export default function OfflinePage() {
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 420 }}>
        <div style={{ fontSize: "2rem" }}>🫗</div>
        <p
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "1.5rem",
            fontWeight: 500,
            color: "var(--c-n500)",
          }}
        >
          Du bist offline.
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--c-n400)" }}>
          Guide Philippe braucht eine Internetverbindung. Sobald du wieder online bist, lädt die Seite normal weiter.
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          style={{
            marginTop: 8,
            fontSize: "0.875rem",
            fontWeight: 500,
            letterSpacing: "0.03em",
            padding: "10px 24px",
            border: "none",
            borderRadius: 9999,
            background: "var(--c-burg)",
            color: "white",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}
