"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import type { RequestPasswordResetState } from "@/app/actions/auth";

// Logged-in "change password" entry point in the Header — reuses the same
// e-mail recovery link as the logged-out "forgot password" flow on the login
// page (app/actions/auth.ts: requestPasswordReset) rather than an inline
// old-password/new-password form.
export function ChangePasswordButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState<RequestPasswordResetState, FormData>(
    requestPasswordReset,
    null
  );

  if (state && "success" in state) {
    return (
      <span style={{ fontSize: "0.8125rem", color: "var(--c-success)", padding: "7px 4px" }}>
        Link verschickt
      </span>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        style={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "var(--c-n500)",
          background: "none",
          border: "none",
          cursor: pending ? "default" : "pointer",
          padding: "7px 4px",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Sende…" : "Passwort ändern"}
      </button>
    </form>
  );
}
