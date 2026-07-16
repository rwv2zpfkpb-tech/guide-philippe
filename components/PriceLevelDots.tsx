// Renders 1–4 "€" symbols, dimming the ones above `level` (0 = kostenlos, shown as text).
// Previously reimplemented separately in RestaurantCard, the restaurant
// detail page, and SearchResultsView.
export function PriceLevelDots({ level }: { level: number | null }) {
  if (level == null) return null;
  if (level === 0) return <span style={{ color: "var(--c-n400)" }}>Kostenlos</span>;
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i <= level ? "var(--c-ink)" : "var(--c-n200)" }}>
          €
        </span>
      ))}
    </>
  );
}
