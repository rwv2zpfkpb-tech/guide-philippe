"use client";

import { useState } from "react";
import FilterBar, { EMPTY_FILTER_SELECTION, type FilterSelection } from "@/components/FilterBar";
import { LocationSearch, type RestaurantHint } from "@/components/LocationSearch";

type HeroSearchProps = {
  cuisines: string[];
  restaurantHints: RestaurantHint[];
};

export function HeroSearch({ cuisines, restaurantHints }: HeroSearchProps) {
  const [selected, setSelected] = useState<FilterSelection>(EMPTY_FILTER_SELECTION);

  const toggleCuisine = (value: string) =>
    setSelected((s) => ({
      ...s,
      cuisine: s.cuisine.includes(value) ? s.cuisine.filter((v) => v !== value) : [...s.cuisine, value],
    }));

  const togglePrice = (value: number) =>
    setSelected((s) => ({
      ...s,
      price_level: s.price_level.includes(value)
        ? s.price_level.filter((v) => v !== value)
        : [...s.price_level, value],
    }));

  const toggleSpoon = (value: number) =>
    setSelected((s) => ({
      ...s,
      spoon_rating: s.spoon_rating.includes(value)
        ? s.spoon_rating.filter((v) => v !== value)
        : [...s.spoon_rating, value],
    }));

  const clearCuisine = () => setSelected((s) => ({ ...s, cuisine: [] }));
  const clearPrice = () => setSelected((s) => ({ ...s, price_level: [] }));
  const clearSpoon = () => setSelected((s) => ({ ...s, spoon_rating: [] }));
  const clearAll = () => setSelected(EMPTY_FILTER_SELECTION);

  return (
    <>
      {/* Location search bar — position+zIndex ensures its dropdown stacking context
          paints above the FilterBar's own stacking context (both created by fadeUp animation) */}
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto 28px",
          animation: "fadeUp 0.8s var(--ease) 0.35s both",
          position: "relative",
          zIndex: 10,
        }}
      >
        <LocationSearch size="large" restaurants={restaurantHints} filters={selected} />
      </div>

      {/* Filter chips — staged locally; only take effect once "Suchen" is pressed above */}
      <div style={{ animation: "fadeUp 0.8s var(--ease) 0.45s both", position: "relative", zIndex: 1 }}>
        <FilterBar
          cuisines={cuisines}
          selected={selected}
          onToggleCuisine={toggleCuisine}
          onTogglePrice={togglePrice}
          onToggleSpoon={toggleSpoon}
          onClearCuisine={clearCuisine}
          onClearPrice={clearPrice}
          onClearSpoon={clearSpoon}
          onClearAll={clearAll}
        />
      </div>
    </>
  );
}
