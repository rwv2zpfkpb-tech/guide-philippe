import type { CSSProperties } from "react";

// Generic filled/empty circle rating indicator — dot i (0..max) is filled
// when i <= value. Used for spoon-rating-style displays (max=3) and the
// 0–5 editorial category ratings (max=5). Renders <button>s (clickable,
// via onChange) when used inside a Client Component like AdminDashboard,
// or plain <span>s for read-only display on server-rendered pages.
export function RatingDots({
  value,
  max,
  size = 8,
  onChange,
}: {
  value: number | null;
  max: number;
  size?: number;
  onChange?: (value: number) => void;
}) {
  const dots = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div style={{ display: "flex", gap: Math.max(4, Math.round(size * 0.75)) }}>
      {dots.map((i) => {
        const filled = value != null && i <= value;
        const style: CSSProperties = {
          width: size,
          height: size,
          borderRadius: "50%",
          background: filled ? "var(--c-gold)" : "var(--c-n200)",
          flexShrink: 0,
          padding: 0,
          border: "none",
        };

        return onChange ? (
          <button
            key={i}
            type="button"
            aria-label={`${i} von ${max}`}
            onClick={() => onChange(i)}
            style={{ ...style, cursor: "pointer" }}
          />
        ) : (
          <span key={i} aria-hidden style={style} />
        );
      })}
    </div>
  );
}
