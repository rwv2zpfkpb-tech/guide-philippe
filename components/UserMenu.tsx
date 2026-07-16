"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { signOut, requestPasswordReset } from "@/app/actions/auth";
import type { RequestPasswordResetState } from "@/app/actions/auth";
import { IconDotsVertical } from "@/components/icons";

// Sign-out + change-password are tucked behind a kebab menu instead of
// sitting as separate buttons in the header — keeps the header itself down
// to just the username on narrow viewports.
export function UserMenu({ email, label }: { email: string; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [resetState, resetAction, resetPending] = useActionState<
    RequestPasswordResetState,
    FormData
  >(requestPasswordReset, null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontSize: "0.8125rem",
          color: "var(--c-n500)",
          padding: "7px 4px",
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Konto-Menü"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--c-n200)",
          background: open ? "var(--c-n50)" : "var(--c-surface)",
          color: "var(--c-ink)",
          cursor: "pointer",
        }}
      >
        <IconDotsVertical size={18} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            background: "var(--c-surface)",
            border: "1px solid var(--c-n100)",
            borderRadius: 10,
            boxShadow: "var(--s-md)",
            padding: 6,
            zIndex: 50,
          }}
        >
          {resetState && "success" in resetState ? (
            <div style={{ fontSize: "0.8125rem", color: "var(--c-success)", padding: "8px 10px" }}>
              Link verschickt
            </div>
          ) : (
            <form action={resetAction}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                disabled={resetPending}
                role="menuitem"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--c-ink)",
                  background: "none",
                  border: "none",
                  borderRadius: 6,
                  padding: "9px 10px",
                  cursor: resetPending ? "default" : "pointer",
                  opacity: resetPending ? 0.6 : 1,
                }}
              >
                {resetPending ? "Sende…" : "Passwort ändern"}
              </button>
            </form>
          )}

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--c-burg)",
                background: "none",
                border: "none",
                borderRadius: 6,
                padding: "9px 10px",
                cursor: "pointer",
              }}
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
