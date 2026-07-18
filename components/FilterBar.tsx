"use client";

import { SPOON_RATINGS, SPOON_RATING_ORDER } from "@/lib/ratings";
import { CuisineFilterDropdown } from "@/components/CuisineFilterDropdown";

const PRICE_CHIPS = [
  { value: 0, label: "Kostenlos" },
  { value: 1, label: "€" },
  { value: 2, label: "€€" },
  { value: 3, label: "€€€" },
  { value: 4, label: "€€€€" },
];

const SPOON_CHIPS = SPOON_RATING_ORDER.map((value) => ({
  value,
  label: SPOON_RATINGS[value].emoji,
  title: SPOON_RATINGS[value].label,
}));

export type FilterSelection = {
  cuisine: string[];
  price_level: number[];
  spoon_rating: number[];
};

export const EMPTY_FILTER_SELECTION: FilterSelection = {
  cuisine: [],
  price_level: [],
  spoon_rating: [],
};

interface FilterBarProps {
  cuisines: string[];
  selected: FilterSelection;
  onToggleCuisine: (value: string) => void;
  onTogglePrice: (value: number) => void;
  onToggleSpoon: (value: number) => void;
  onClearCuisine: () => void;
  onClearPrice: () => void;
  onClearSpoon: () => void;
  onClearAll: () => void;
}

const chipBase: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.03em",
  padding: "6px 14px",
  borderRadius: 9999,
  border: "1px solid var(--c-n200)",
  background: "var(--c-surface)",
  color: "var(--c-n600)",
  cursor: "pointer",
  transition: "all 0.18s var(--ease)",
  whiteSpace: "nowrap" as const,
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  background: "var(--c-burg)",
  border: "1px solid var(--c-burg)",
  color: "white",
};

const rowLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--c-n400)",
  width: 78,
  flexShrink: 0,
};

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="filter-row" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={rowLabel}>{label}</span>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

export default function FilterBar({
  cuisines,
  selected,
  onToggleCuisine,
  onTogglePrice,
  onToggleSpoon,
  onClearCuisine,
  onClearPrice,
  onClearSpoon,
  onClearAll,
}: FilterBarProps) {
  const activeCount =
    selected.cuisine.length + selected.price_level.length + selected.spoon_rating.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "18px 24px",
        borderRadius: 16,
        border: "1px solid var(--c-n200)",
        background: "var(--c-surface)",
        boxShadow: "var(--s-sm)",
        textAlign: "left",
      }}
    >
      {cuisines.length > 0 && (
        <FilterRow label="Küche">
          <CuisineFilterDropdown
            cuisines={cuisines}
            selected={selected.cuisine}
            onToggle={onToggleCuisine}
            onClear={onClearCuisine}
            label="Alle Küchen"
          />
        </FilterRow>
      )}

      <FilterRow label="Preis">
        <button
          onClick={onClearPrice}
          className={selected.price_level.length === 0 ? "filter-chip is-active" : "filter-chip"}
          style={selected.price_level.length === 0 ? chipActive : chipBase}
        >
          Alle
        </button>
        {PRICE_CHIPS.map((p) => (
          <button
            key={p.value}
            onClick={() => onTogglePrice(p.value)}
            className={selected.price_level.includes(p.value) ? "filter-chip is-active" : "filter-chip"}
            style={selected.price_level.includes(p.value) ? chipActive : chipBase}
          >
            {p.label}
          </button>
        ))}
      </FilterRow>

      <FilterRow label="Bewertung">
        <button
          onClick={onClearSpoon}
          className={selected.spoon_rating.length === 0 ? "filter-chip is-active" : "filter-chip"}
          style={selected.spoon_rating.length === 0 ? chipActive : chipBase}
        >
          Alle
        </button>
        {SPOON_CHIPS.map((s) => (
          <button
            key={s.value}
            onClick={() => onToggleSpoon(s.value)}
            className={selected.spoon_rating.includes(s.value) ? "filter-chip is-active" : "filter-chip"}
            style={selected.spoon_rating.includes(s.value) ? chipActive : chipBase}
            title={s.title}
          >
            {s.label}
          </button>
        ))}
      </FilterRow>

      {activeCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTop: "1px solid var(--c-n100)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--c-n400)", letterSpacing: "0.03em" }}>
            {activeCount} {activeCount === 1 ? "Filter" : "Filter"} ausgewählt
          </span>
          <button
            onClick={onClearAll}
            style={{
              fontSize: 11,
              color: "var(--c-burg)",
              background: "none",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.04em",
              padding: 0,
              fontWeight: 500,
            }}
          >
            ✕ Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
