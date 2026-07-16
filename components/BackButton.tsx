"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBack } from "@/components/icons";

type Props = {
  /** Where to send the user if there is no in-app history to go back to
   *  (e.g. the page was opened directly / in a new tab). */
  fallbackHref: string;
  label?: string;
};

// router.back() only makes sense when the previous history entry is actually
// this app (e.g. coming from the search results list) — a direct link/new
// tab has no useful "back" target, so we fall back to a normal link instead.
export function BackButton({ fallbackHref, label = "Zurück" }: Props) {
  const router = useRouter();
  const [hasInAppHistory, setHasInAppHistory] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasInAppHistory(
      window.history.length > 1 && document.referrer.startsWith(window.location.origin)
    );
  }, []);

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

  if (hasInAppHistory) {
    return (
      <button type="button" onClick={() => router.back()} style={style}>
        <IconBack size={14} />
        {label}
      </button>
    );
  }

  return (
    <Link href={fallbackHref} style={style}>
      <IconBack size={14} />
      {label}
    </Link>
  );
}
