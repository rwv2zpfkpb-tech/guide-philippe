"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PRICE_CHIPS = [
  { value: "1", label: "€" },
  { value: "2", label: "€€" },
  { value: "3", label: "€€€" },
  { value: "4", label: "€€€€" },
];

const SPOON_CHIPS = [
  { value: "3", label: "🍽️" },
  { value: "2", label: "🍴" },
  { value: "1", label: "🥄" },
  { value: "0", label: "🫗" },
];

interface FilterBarProps {
  cuisines: string[];
}

const chipBase: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.03em",
  padding: "6px 14px",
  borderRadius: 9999,
  border: "1px solid var(--c-n200)",
  background: "white",
  color: "var(--c-n600)",
  cursor: "pointer",
  transition: "all 0.18s var(--ease)",
  whiteSpace: "nowrap" as const,
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  background: "var(--c-burg)",
  borderColor: "var(--c-burg)",
  color: "white",
};

const sep: React.CSSProperties = {
  width: 1,
  height: 18,
  background: "var(--c-n200)",
  margin: "0 4px",
  flexShrink: 0,
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--c-n400)",
  padding: "0 4px",
};

export default function FilterBar({ cuisines }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value !== null) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : "/");
    },
    [router, searchParams]
  );

  const toggleFilter = useCallback(
    (key: string, value: string) => {
      const current = searchParams.get(key);
      updateFilter(key, current === value ? null : value);
    },
    [searchParams, updateFilter]
  );

  const cuisine = searchParams.get("cuisine");
  const priceLevel = searchParams.get("price_level");
  const spoonRating = searchParams.get("spoon_rating");
  const hasFilters = cuisine || priceLevel || spoonRating !== null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        flexWrap: "wrap",
      }}
    >
      {cuisines.length > 0 && (
        <>
          <span style={label}>Küche</span>
          <button
            onClick={() => updateFilter("cuisine", null)}
            style={!cuisine ? chipActive : chipBase}
          >
            Alle
          </button>
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => updateFilter("cuisine", cuisine === c ? null : c)}
              style={cuisine === c ? chipActive : chipBase}
            >
              {c}
            </button>
          ))}
          <div style={sep} />
        </>
      )}

      <span style={label}>Preis</span>
      {PRICE_CHIPS.map((p) => (
        <button
          key={p.value}
          onClick={() => toggleFilter("price_level", p.value)}
          style={priceLevel === p.value ? chipActive : chipBase}
        >
          {p.label}
        </button>
      ))}

      <div style={sep} />

      <span style={label}>Bewertung</span>
      {SPOON_CHIPS.map((s) => (
        <button
          key={s.value}
          onClick={() => toggleFilter("spoon_rating", s.value)}
          style={spoonRating === s.value ? chipActive : chipBase}
          title={["Not Recommended", "Remembering", "Worth Mentioning", "Absolute Recommendation"][Number(s.value)]}
        >
          {s.label}
        </button>
      ))}

      {hasFilters && (
        <>
          <div style={sep} />
          <button
            onClick={() => router.push("/")}
            style={{
              fontSize: 11,
              color: "var(--c-n400)",
              background: "none",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.04em",
              padding: "0 4px",
            }}
          >
            ✕ Zurücksetzen
          </button>
        </>
      )}
    </div>
  );
}
