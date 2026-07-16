import type { CSSProperties } from "react";

// Generic filled/empty circle rating indicator — dot i (min..max) is filled
// when i <= value. Used for spoon-rating-style displays (min=0, max=3) and
// the 1–5 editorial category ratings (min=1, max=5). Renders <button>s
// (clickable, via onChange) when used inside a Client Component like
// AdminDashboard, or plain <span>s for read-only display on server-rendered
// pages. `color` lets callers color-code filled dots (e.g. by spoon rating
// tier) instead of the default gold.
export function RatingDots({
  value,
  max,
  min = 0,
  size = 8,
  color,
  onChange,
}: {
  value: number | null;
  max: number;
  min?: number;
  size?: number;
  color?: string;
  onChange?: (value: number) => void;
}) {
  const dots = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div style={{ display: "flex", gap: Math.max(4, Math.round(size * 0.75)) }}>
      {dots.map((i) => {
        const filled = value != null && i <= value;
        const style: CSSProperties = {
          width: size,
          height: size,
          borderRadius: "50%",
          background: filled ? (color ?? "var(--c-gold)") : "var(--c-n200)",
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
