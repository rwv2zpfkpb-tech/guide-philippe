"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";

// Horizontal card row (Landing-Page "Auswahl"/"Neu hinzugefügt"). A plain
// `overflowX: auto` div only reacts to a trackpad's native horizontal swipe
// or a dragged scrollbar — a normal vertical mouse wheel does nothing (no
// browser auto-converts deltaY to scrollLeft here), so mouse-only users had
// no way to reach cards past the visible width. This wrapper converts
// vertical wheel input into horizontal scrolling and adds arrow buttons
// (shown whenever there's more to scroll to) for discoverability/click-to-scroll.
export function HorizontalScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = ref.current;
    if (!el) return;
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);

    // A plain React onWheel handler is registered passive (React's default
    // for wheel/touch listeners), so preventDefault() inside it is a no-op —
    // the row would scroll horizontally AND the page would scroll vertically
    // at the same time. A manually attached, non-passive listener is needed
    // to actually suppress the page scroll while the row absorbs it.
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      // Only take over plain vertical wheel input — a trackpad's own
      // horizontal gesture (deltaX already dominant) is left untouched.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("resize", onResize);
      el.removeEventListener("wheel", onWheel);
    };
  }, [children]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={ref}
        onScroll={updateArrows}
        style={{ display: "flex", gap: 16, overflowX: "auto", paddingTop: 10, paddingBottom: 12 }}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          aria-label="Nach links scrollen"
          onClick={() => scrollBy(-1)}
          style={arrowStyle("left")}
        >
          <span style={{ display: "flex", transform: "rotate(90deg)" }}>
            <IconChevronDown size={16} />
          </span>
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Nach rechts scrollen"
          onClick={() => scrollBy(1)}
          style={arrowStyle("right")}
        >
          <span style={{ display: "flex", transform: "rotate(-90deg)" }}>
            <IconChevronDown size={16} />
          </span>
        </button>
      )}
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: -4,
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--c-n200)",
    background: "var(--c-surface)",
    color: "var(--c-ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--s-sm)",
    cursor: "pointer",
    zIndex: 1,
  };
}
