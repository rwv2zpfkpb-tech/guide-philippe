"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

type Props = {
  /** Where to send the user if there is no in-app history to go back to
   *  (e.g. the page was opened directly / in a new tab). */
  fallbackHref: string;
  label?: string;
};

// Always mirror the browser's real Back action so navigation returns to the
// actual previous route instead of guessing from a potentially stale referrer.
// A directly opened page has no previous history entry and uses the explicit
// route fallback instead.
export function BackButton({ fallbackHref, label = "Zurück" }: Props) {
  const router = useRouter();

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--c-n500)",
    border: "1px solid var(--c-n200)",
    borderRadius: 9999,
    padding: "6px 16px 6px 12px",
    background: "var(--c-surface)",
    boxShadow: "var(--s-sm)",
    cursor: "pointer",
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      style={style}
    >
      <IconBack size={14} />
      {label}
    </button>
  );
}
