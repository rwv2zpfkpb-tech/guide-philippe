"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "@/components/icons";
import styles from "./CuisineFilterDropdown.module.css";

type Props = {
  cuisines: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  label?: string;
  counts?: Record<string, number>;
  presentation?: "popover" | "inline";
};

export function CuisineFilterDropdown({
  cuisines,
  selected,
  onToggle,
  onClear,
  label = "Küchen auswählen",
  counts,
  presentation = "popover",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const isInSheet = target instanceof Element && target.closest(`.${styles.mobileLayer}`);
      if (rootRef.current && !rootRef.current.contains(target) && !isInSheet) close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || presentation !== "inline" || !window.matchMedia("(max-width: 640px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, presentation]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    return cuisines.filter((cuisine) => cuisine.toLocaleLowerCase("de").includes(query));
  }, [cuisines, search]);

  if (cuisines.length === 0) return null;

  const trigger = (
    <div className={styles.triggerRow}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
      >
        {selected.length > 0 ? `${selected.length} ausgewählt` : label}
        <span className={styles.chevron} data-open={open}>
          <IconChevronDown size={13} />
        </span>
      </button>

      {presentation === "inline" && selected.map((cuisine) => (
        <button
          type="button"
          key={cuisine}
          className={styles.selectedChip}
          onClick={() => onToggle(cuisine)}
          aria-label={`${cuisine} entfernen`}
        >
          <span>{cuisine}</span><span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );

  const panelContent = (
    <>
      <input
        type="search"
        className={styles.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Küche suchen…"
      />

      <div className={styles.options} role="group" aria-label="Küchen">
        {filtered.length === 0 && <p className={styles.empty}>Keine Küche gefunden.</p>}
        {filtered.map((cuisine) => {
          const active = selected.includes(cuisine);
          return (
            <label key={cuisine} className={styles.option} data-selected={active}>
              <input type="checkbox" checked={active} onChange={() => onToggle(cuisine)} />
              <span className={styles.optionName}>{cuisine}</span>
              {counts && <span className={styles.count}>{counts[cuisine] ?? 0}</span>}
            </label>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span>{selected.length} {selected.length === 1 ? "Küche" : "Küchen"}</span>
        <div className={styles.footerActions}>
          {selected.length > 0 && (
            <button type="button" className={styles.reset} onClick={onClear}>Zurücksetzen</button>
          )}
          <button type="button" className={styles.done} onClick={close}>Fertig</button>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${presentation === "inline" ? styles.inlineRoot : styles.popoverRoot}`}
      data-open={open}
    >
      {trigger}

      {open && presentation === "inline" && (
        <div className={styles.inlinePanel}>{panelContent}</div>
      )}

      {open && presentation === "popover" && (
        <div className={styles.popover}>{panelContent}</div>
      )}

      {open && presentation === "inline" && createPortal(
        <div className={styles.mobileLayer}>
          <button type="button" className={styles.backdrop} onClick={close} aria-label="Schließen" />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Küchen auswählen">
            <div className={styles.sheetHeading}>
              <strong>Küchen auswählen</strong>
              <button type="button" onClick={close} aria-label="Schließen">×</button>
            </div>
            {panelContent}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
