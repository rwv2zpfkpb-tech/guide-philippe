// Renders 1–4 "€" symbols, dimming the ones above `level`.
// Previously reimplemented separately in RestaurantCard, the restaurant
// detail page, and SearchResultsView.
export function PriceLevelDots({ level }: { level: number | null }) {
  if (!level) return null;
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
