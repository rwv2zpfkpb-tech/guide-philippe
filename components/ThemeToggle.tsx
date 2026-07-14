"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getEffectiveTheme(): Theme {
  // Read the data-theme attribute the server already set, or fall back
  // to the system preference if the user hasn't made an explicit choice.
  const attr = document.documentElement.dataset.theme as Theme | undefined;
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setThemeCookie(theme: Theme) {
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  document.cookie = `gp-theme=${theme}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function ThemeToggle() {
  // Always default to "light" for SSR so server and first client render match.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Sync with the actual theme after hydration (no hydration mismatch).
    // The real theme is only knowable client-side (DOM attribute / matchMedia),
    // so this can't be computed during render — the sync-after-mount is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getEffectiveTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";

    // 1. Apply immediately to the DOM — CSS responds at once.
    document.documentElement.dataset.theme = next;

    // 2. Persist via cookie so the server can set data-theme on next load.
    setThemeCookie(next);

    // 3. Update React state → re-render icon.
    setThemeState(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"}
      title={isDark ? "Hellmodus" : "Dunkelmodus"}
      style={{
        width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 9999, border: "1px solid var(--c-n200)",
        background: "var(--c-surface)", color: "var(--c-n500)",
        cursor: "pointer", flexShrink: 0,
        transition: "background .2s, color .2s, border-color .2s",
      }}
      onMouseOver={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = "var(--c-n100)";
        b.style.color = "var(--c-ink)";
      }}
      onMouseOut={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = "var(--c-surface)";
        b.style.color = "var(--c-n500)";
      }}
    >
      {isDark ? (
        /* Sun — shown in dark mode */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1"  x2="12" y2="3"  />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1"  y1="12" x2="3"  y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
          <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
        </svg>
      ) : (
        /* Moon — shown in light mode */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
