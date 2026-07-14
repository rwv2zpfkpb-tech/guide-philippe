"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUp } from "@/app/actions/auth";
import type { SignInState, SignUpState } from "@/app/actions/auth";

type Tab = "login" | "signup";

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
  transition: "border-color 0.2s, box-shadow 0.2s",
};

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={name}
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--c-n500)",
        }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--c-gold)";
          e.target.style.boxShadow = "var(--s-focus)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--c-n200)";
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

export default function LoginForm({ defaultTab }: { defaultTab: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [loginState, loginAction, loginPending] = useActionState<SignInState, FormData>(
    signIn,
    null
  );
  const [signupState, signupAction, signupPending] = useActionState<SignUpState, FormData>(
    signUp,
    null
  );

  // ── Email confirmation sent ──────────────────────────────────────────────────
  if (tab === "signup" && signupState && "success" in signupState) {
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
        <div style={{ fontSize: "2.5rem", marginBottom: 20 }}>✉️</div>
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
          Bitte bestätige deine E-Mail
        </div>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--c-n500)",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          Wir haben dir einen Bestätigungslink geschickt. Bitte öffne deine E-Mails und
          klicke auf den Link, um dein Konto zu aktivieren.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            borderRadius: 8,
            border: "1px solid var(--c-n200)",
            background: "var(--c-surface)",
            color: "var(--c-ink)",
          }}
        >
          Zurück zur Startseite
        </Link>
      </div>
    );
  }

  const error =
    tab === "login"
      ? loginState && "error" in loginState
        ? loginState.error
        : null
      : signupState && "error" in signupState
      ? signupState.error
      : null;

  const isPending = loginPending || signupPending;

  return (
    <div
      style={{
        background: "var(--c-surface)",
        borderRadius: 22,
        padding: 40,
        maxWidth: 400,
        width: "100%",
        boxShadow: "var(--s-lg)",
        position: "relative",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: "var(--font-cormorant)",
          fontSize: "1.25rem",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--c-ink)",
          marginBottom: 8,
        }}
      >
        Guide <span style={{ color: "var(--c-burg)" }}>Philippe</span>
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: "var(--font-cormorant)",
          fontSize: "1.75rem",
          fontWeight: 500,
          color: "var(--c-ink)",
          marginBottom: 24,
          lineHeight: 1.1,
        }}
      >
        {tab === "login" ? "Willkommen zurück." : "Konto erstellen."}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          border: "1px solid var(--c-n200)",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 28,
        }}
      >
        {(["login", "signup"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: 9,
              fontSize: "0.8125rem",
              fontWeight: 500,
              background: tab === t ? "var(--c-ink)" : "transparent",
              color: tab === t ? "white" : "var(--c-n500)",
              border: "none",
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {t === "login" ? "Anmelden" : "Registrieren"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
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
          {error}
        </div>
      )}

      {/* Forms */}
      <form
        key={tab}
        action={tab === "login" ? loginAction : signupAction}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {tab === "signup" && (
          <Field
            label="Benutzername"
            name="username"
            autoComplete="username"
            placeholder="dein_name"
          />
        )}
        <Field
          label="E-Mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="du@beispiel.de"
        />
        <Field
          label="Passwort"
          name="password"
          type="password"
          autoComplete={tab === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: "100%",
            fontFamily: "inherit",
            fontSize: "0.9375rem",
            fontWeight: 500,
            padding: 13,
            borderRadius: 8,
            border: "none",
            background: "var(--c-ink)",
            color: "var(--c-bg)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
            marginTop: 6,
            transition: "background 0.2s, transform 0.18s",
          }}
        >
          {isPending
            ? tab === "login"
              ? "Anmelden…"
              : "Konto erstellen…"
            : tab === "login"
            ? "Anmelden"
            : "Konto erstellen"}
        </button>
      </form>

      {/* Switch tab note */}
      <p
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--c-n400)",
        }}
      >
        {tab === "login" ? (
          <>
            Noch kein Konto?{" "}
            <button
              type="button"
              onClick={() => setTab("signup")}
              style={{
                background: "none",
                border: "none",
                color: "var(--c-gold)",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Jetzt registrieren →
            </button>
          </>
        ) : (
          <>
            Bereits ein Konto?{" "}
            <button
              type="button"
              onClick={() => setTab("login")}
              style={{
                background: "none",
                border: "none",
                color: "var(--c-gold)",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Anmelden →
            </button>
          </>
        )}
      </p>
    </div>
  );
}
