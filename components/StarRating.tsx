// Read-only average star display with fractional (e.g. half-star) fill —
// used next to the "Reader Experiences" heading. Each star is rendered as a
// grey base glyph with a gold glyph clipped to `pct`% width stacked on top,
// so a 3.5-average fills 3 stars fully and the 4th to 50%.
export function StarRating({
  average,
  size = 16,
}: {
  average: number | null;
  size?: number;
}) {
  if (average == null) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const pct = Math.max(0, Math.min(1, average - (i - 1))) * 100;
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                width: "1em",
                fontSize: size,
                lineHeight: 1,
              }}
            >
              <span style={{ color: "var(--c-n200)" }}>★</span>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  width: `${pct}%`,
                  color: "var(--c-gold)",
                }}
              >
                ★
              </span>
            </span>
          );
        })}
      </div>
      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--c-ink)" }}>
        {average.toFixed(1)} / 5
      </span>
    </div>
  );
}
