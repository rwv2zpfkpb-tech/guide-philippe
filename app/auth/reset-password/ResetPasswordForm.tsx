"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword } from "@/app/actions/auth";
import type { UpdatePasswordState } from "@/app/actions/auth";
import { IconCheckCircle } from "@/components/icons";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "inherit",
  fontSize: "0.9375rem",
  padding: "11px 15px",
  border: "1px solid var(--c-n200)",
  borderRadius: 8,
  background: "var(--c-surface)",
  color: "var(--c-ink)",
  outline: "none",
};

export default function ResetPasswordForm({ tokenHash }: { tokenHash: string }) {
  const [state, action, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    null
  );

  if (state && "success" in state) {
    return (
      <div
        style={{
          background: "var(--c-surface)",
          borderRadius: 22,
          padding: 40,
          maxWidth: 400,
          width: "100%",
          boxShadow: "var(--s-lg)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: "var(--c-success)" }}>
          <IconCheckCircle size={40} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "1.75rem",
            fontWeight: 500,
            color: "var(--c-ink)",
            marginBottom: 12,
            lineHeight: 1.1,
          }}
        >
          Passwort geändert
        </div>
        <p style={{ fontSize: "0.9375rem", color: "var(--c-n500)", lineHeight: 1.65, marginBottom: 28 }}>
          Dein neues Passwort ist gespeichert. Du bist bereits angemeldet.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "var(--c-ink)",
            color: "var(--c-bg)",
          }}
        >
          Zur Startseite
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--c-surface)",
        borderRadius: 22,
        padding: 40,
        maxWidth: 400,
        width: "100%",
        boxShadow: "var(--s-lg)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-cormorant)",
          fontSize: "1.75rem",
          fontWeight: 500,
          color: "var(--c-ink)",
          marginBottom: 8,
          lineHeight: 1.1,
        }}
      >
        Neues Passwort vergeben
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--c-n500)", marginBottom: 24 }}>
        Wähle ein neues Passwort für dein Konto.
      </p>

      {state && "error" in state && (
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--c-burg)",
            background: "var(--c-burg-light)",
            border: "1px solid oklch(83% 0.030 17)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          {state.error}
        </div>
      )}

      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="password"
            style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--c-n500)" }}
          >
            Neues Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="confirmPassword"
            style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--c-n500)" }}
          >
            Passwort bestätigen
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

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
            marginTop: 6,
          }}
        >
          {pending && <span className="gp-spinner-sm" aria-hidden />}
          {pending ? "Speichert…" : "Passwort speichern"}
        </button>
      </form>
    </div>
  );
}
