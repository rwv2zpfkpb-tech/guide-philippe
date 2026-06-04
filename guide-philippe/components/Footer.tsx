export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--c-burg)",
        padding: "36px 40px",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "oklch(90% 0.018 17)",
          }}
        >
          Guide{" "}
          <span style={{ color: "white" }}>Philippe</span>.
        </div>

        <nav style={{ display: "flex", gap: 28 }}>
          {["Über uns", "Städte", "Küchen", "Kontakt"].map((link) => (
            <span
              key={link}
              style={{
                fontSize: "0.75rem",
                color: "oklch(72% 0.024 17)",
                letterSpacing: "0.04em",
              }}
            >
              {link}
            </span>
          ))}
        </nav>

        <span
          style={{
            fontSize: "0.6875rem",
            color: "oklch(60% 0.020 17)",
            letterSpacing: "0.03em",
          }}
        >
          © {new Date().getFullYear()} Guide Philippe
        </span>
      </div>
    </footer>
  );
}
