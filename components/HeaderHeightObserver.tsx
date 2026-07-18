"use client";

import { useEffect } from "react";

// The global <Header> has a `minHeight: 64` but wraps onto a second row
// (flexWrap+rowGap) on narrow viewports once the nav (theme toggle/admin
// link/user menu) no longer fits next to the logo — its real rendered
// height can then exceed 64px. SearchResultsView's full-viewport layout
// (`.sr-outer`, height: calc(100vh - var(--header-height))) needs the
// *actual* height to size itself correctly; a hardcoded 64px caused it to
// overflow past the viewport on exactly those narrow/wrapped-header cases,
// which in turn made the fixed list/map toggle button overlap the last
// result row (the whole point of this observer).
export function HeaderHeightObserver() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const setHeight = () => {
      document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    };

    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return null;
}
