"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";

// Cuisine values are open-ended and grow with the restaurant list (already
// dozens of distinct values, unlike price/rating's small fixed sets) — a
// chip row doesn't scale, so this is a searchable multi-select dropdown
// instead. Shared between the landing page (FilterBar), the search results
// view, and the admin dashboard's own filter panel — all three need the
// same "many cuisines, pick a few" interaction.
export function CuisineFilterDropdown({
  cuisines,
  selected,
  onToggle,
  onClear,
  label = "Küche",
}: {
  cuisines: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = cuisines.filter((c) => c.toLowerCase().includes(search.toLowerCase()));

  if (cuisines.length === 0) return null;

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() =>
          setOpen((v) => {
            if (v) setSearch("");
            return !v;
          })
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.03em",
          padding: "6px 12px",
          borderRadius: 9999,
          border: `1px solid ${selected.length > 0 ? "var(--c-burg)" : "var(--c-n200)"}`,
          background: selected.length > 0 ? "var(--c-burg)" : "var(--c-surface)",
          color: selected.length > 0 ? "white" : "var(--c-n600)",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {selected.length > 0 && ` (${selected.length})`}
        <span style={{ display: "flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }}>
          <IconChevronDown size={12} />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
            width: 240,
            maxWidth: "80vw",
            background: "var(--c-surface)",
            border: "1px solid var(--c-n200)",
            borderRadius: 12,
            boxShadow: "var(--s-lg)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Küche suchen…"
            style={{
              fontSize: 13,
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--c-n200)",
              background: "var(--c-bg)",
              color: "var(--c-ink)",
              fontFamily: "inherit",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--c-n400)", padding: "6px 4px" }}>Keine Treffer.</p>
            )}
            {filtered.map((c) => {
              const isSelected = selected.includes(c);
              return (
                <label
                  key={c}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--c-ink)",
                    padding: "6px 4px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  className="cuisine-dropdown-row"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(c)}
                    style={{ accentColor: "var(--c-burg)" }}
                  />
                  {c}
                </label>
              );
            })}
          </div>

          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--c-burg)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: "4px 4px 0",
                fontFamily: "inherit",
                borderTop: "1px solid var(--c-n100)",
              }}
            >
              Auswahl zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
