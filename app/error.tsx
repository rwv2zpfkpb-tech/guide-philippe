"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          Da ist etwas schiefgelaufen.
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--c-n400)" }}>
          Vermutlich ein kurzer Verbindungsfehler. Bitte versuche es erneut.
        </p>
        <button
          type="button"
          onClick={() => reset()}
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
