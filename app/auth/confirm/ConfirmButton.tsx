"use client";

import { useActionState } from "react";
import { confirmEmailToken, type ConfirmEmailState } from "@/app/actions/auth";

// Submitting this form (not the page load) is what actually consumes the
// token — see app/actions/auth.ts's confirmEmailToken for why (mail-link
// prescanning must not be able to invalidate the link before the user acts).
export function ConfirmButton({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState<ConfirmEmailState, FormData>(confirmEmailToken, null);

  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />

      {state?.error && (
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--c-burg)",
            background: "var(--c-burg-light)",
            border: "1px solid oklch(83% 0.030 17)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            textAlign: "left",
          }}
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "inherit",
          fontSize: "0.9375rem",
          fontWeight: 500,
          padding: 13,
          borderRadius: 8,
          border: "none",
          background: "var(--c-ink)",
          color: "var(--c-bg)",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending && <span className="gp-spinner-sm" aria-hidden />}
        {pending ? "Bestätigt…" : "Konto bestätigen"}
      </button>
    </form>
  );
}
