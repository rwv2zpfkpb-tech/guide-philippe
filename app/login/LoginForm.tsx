"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { signIn, signUp, requestPasswordReset, resendConfirmationEmail } from "@/app/actions/auth";
import type {
  SignInState,
  SignUpState,
  RequestPasswordResetState,
  ResendConfirmationState,
} from "@/app/actions/auth";
import { IconMail } from "@/components/icons";

type Tab = "login" | "signup" | "forgot" | "resend";

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
  defaultValue,
  value,
  onChange,
  error,
  inputRef,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
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
        ref={inputRef}
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        {...(value !== undefined ? { value } : { defaultValue })}
        required
        style={{
          ...inputStyle,
          borderColor: error ? "var(--c-burg)" : "var(--c-n200)",
        }}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onFocus={(e) => {
          e.target.style.borderColor = error ? "var(--c-burg)" : "var(--c-gold)";
          e.target.style.boxShadow = "var(--s-focus)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "var(--c-burg)" : "var(--c-n200)";
          e.target.style.boxShadow = "none";
        }}
      />
      {error && (
        <span style={{ fontSize: "0.75rem", color: "var(--c-burg)" }}>{error}</span>
      )}
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
  const [forgotState, forgotAction, forgotPending] = useActionState<
    RequestPasswordResetState,
    FormData
  >(requestPasswordReset, null);
  const [resendState, resendAction, resendPending] = useActionState<
    ResendConfirmationState,
    FormData
  >(resendConfirmationEmail, null);

  // 60-Sekunden-Sperre gegen wiederholtes Anfordern des Bestätigungslinks
  // (rein clientseitiger Schutz vor versehentlichem Spam-Klicken, kein
  // Server-Rate-Limit) — gesetzt im onSubmit-Handler beider Resend-Formulare
  // (Haupt-Tab + "Erneut senden" auf dem Erfolgsscreen), nicht in einem
  // Effekt/während des Renders: Date.now() dort aufzurufen wäre eine
  // unreine Render-Berechnung (React-Compiler-Regel react-hooks/purity).
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendNowTick, setResendNowTick] = useState(() => Date.now());
  function startResendCooldown() {
    setResendAvailableAt(Date.now() + 60_000);
  }
  useEffect(() => {
    if (Date.now() >= resendAvailableAt) return;
    const id = setInterval(() => {
      const now = Date.now();
      setResendNowTick(now);
      if (now >= resendAvailableAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt]);
  const resendCooldownSeconds = Math.max(0, Math.ceil((resendAvailableAt - resendNowTick) / 1000));

  // Nur zum Vorausfüllen des "Bestätigungslink erneut anfordern"-Formulars,
  // falls der Nutzer direkt nach dem Registrieren "Kein Link erhalten?" klickt
  // — keine Server-Kommunikation, rein client-seitiger Komfort. Gleichzeitig
  // Grundlage für den Live-Abgleich E-Mail/E-Mail-bestätigen unten.
  const [signupEmail, setSignupEmail] = useState("");
  const [signupEmailConfirm, setSignupEmailConfirm] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");

  // Controlled statt nur defaultValue, damit die Adresse auch für den
  // "Erneut senden"-Button auf dem Erfolgsscreen (nach Ablauf der 60s-Sperre)
  // ohne erneute Eingabe zur Verfügung steht.
  const [resendEmailValue, setResendEmailValue] = useState("");

  // Vorausfüllung wie vorher per defaultValue, jetzt aber einmalig beim
  // ersten Wechsel auf den Resend-Tab (State-Anpassung im Render statt in
  // einem Effekt, s.o.), weil das Feld für den "Erneut senden"-Button auf
  // dem Erfolgsscreen (s.u.) controlled sein muss.
  const [hasPrefilledResendEmail, setHasPrefilledResendEmail] = useState(false);
  if (tab === "resend" && !hasPrefilledResendEmail && signupEmail) {
    setHasPrefilledResendEmail(true);
    setResendEmailValue(signupEmail);
  }

  const emailConfirmRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  // Live-Abgleich statt erst nach dem Server-Roundtrip: sobald das jeweilige
  // "bestätigen"-Feld befüllt ist, aber vom Original abweicht, wird es rot
  // hervorgehoben — verschwindet automatisch wieder, sobald beide übereinstimmen.
  const emailMismatch =
    signupEmailConfirm.length > 0 && signupEmail.trim() !== signupEmailConfirm.trim();
  const passwordMismatch =
    signupPasswordConfirm.length > 0 && signupPassword !== signupPasswordConfirm;

  function handleSignupSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Bricht den Submit clientseitig ab (Server-Validierung in signUp() bleibt
    // als Fallback bestehen) und fokussiert gezielt das zu korrigierende Feld,
    // statt nur die generische Fehlermeldung aus dem Server-Roundtrip zu zeigen.
    if (emailMismatch) {
      e.preventDefault();
      emailConfirmRef.current?.focus();
      return;
    }
    if (passwordMismatch) {
      e.preventDefault();
      passwordConfirmRef.current?.focus();
    }
  }

  // ── Forgot password ──────────────────────────────────────────────────────────
  if (tab === "forgot") {
    if (forgotState && "success" in forgotState) {
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
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: "var(--c-gold)" }}>
            <IconMail size={40} />
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
            E-Mail verschickt
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--c-n500)", lineHeight: 1.65, marginBottom: 28 }}>
            Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir einen Link zum
            Zurücksetzen des Passworts verschickt.
          </p>
          <button
            type="button"
            onClick={() => setTab("login")}
            style={{
              display: "inline-block",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--c-n200)",
              background: "var(--c-surface)",
              color: "var(--c-ink)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Zurück zum Login
          </button>
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
          Passwort vergessen?
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--c-n500)", marginBottom: 24 }}>
          Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum Zurücksetzen.
        </p>

        {forgotState && "error" in forgotState && (
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
            {forgotState.error}
          </div>
        )}

        <form action={forgotAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="E-Mail" name="email" type="email" autoComplete="email" placeholder="du@beispiel.de" />
          <button
            type="submit"
            disabled={forgotPending}
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
              cursor: forgotPending ? "default" : "pointer",
              opacity: forgotPending ? 0.6 : 1,
              marginTop: 6,
            }}
          >
            {forgotPending && <span className="gp-spinner-sm" aria-hidden />}
            {forgotPending ? "Sende…" : "Link schicken"}
          </button>
        </form>

        <p style={{ marginTop: 18, textAlign: "center", fontSize: "0.8125rem", color: "var(--c-n400)" }}>
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
            ← Zurück zum Login
          </button>
        </p>
      </div>
    );
  }

  // ── Bestätigungslink erneut anfordern ────────────────────────────────────────
  if (tab === "resend") {
    if (resendState && "success" in resendState) {
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
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: "var(--c-gold)" }}>
            <IconMail size={40} />
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
            Link verschickt
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--c-n500)", lineHeight: 1.65, marginBottom: 28 }}>
            Falls das Konto existiert und noch nicht bestätigt ist, haben wir dir einen neuen
            Bestätigungslink verschickt.
          </p>
          <button
            type="button"
            onClick={() => setTab("login")}
            style={{
              display: "inline-block",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--c-n200)",
              background: "var(--c-surface)",
              color: "var(--c-ink)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Zurück zum Login
          </button>

          {/* Erneut senden — erst nach Ablauf der 60s-Sperre klickbar, s.o. */}
          <form action={resendAction} onSubmit={startResendCooldown} style={{ marginTop: 14 }}>
            <input type="hidden" name="email" value={resendEmailValue} readOnly />
            <button
              type="submit"
              disabled={resendPending || resendCooldownSeconds > 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "none",
                border: "none",
                color: resendCooldownSeconds > 0 ? "var(--c-n400)" : "var(--c-gold)",
                fontSize: "0.8125rem",
                fontFamily: "inherit",
                cursor: resendPending || resendCooldownSeconds > 0 ? "default" : "pointer",
                padding: 0,
              }}
            >
              {resendPending && <span className="gp-spinner-sm" aria-hidden />}
              {resendPending
                ? "Sende…"
                : resendCooldownSeconds > 0
                ? `Erneut senden in ${resendCooldownSeconds}s`
                : "Erneut senden"}
            </button>
          </form>
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
          Bestätigungslink erneut anfordern
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--c-n500)", marginBottom: 24 }}>
          Falls dein bisheriger Link abgelaufen ist oder nie angekommen ist, schicken wir dir
          hier einen neuen.
        </p>

        {resendState && "error" in resendState && (
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
            {resendState.error}
          </div>
        )}

        <form action={resendAction} onSubmit={startResendCooldown} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field
            label="E-Mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="philippe@guidephilippe.de"
            value={resendEmailValue}
            onChange={setResendEmailValue}
          />
          <button
            type="submit"
            disabled={resendPending || resendCooldownSeconds > 0}
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
              cursor: resendPending || resendCooldownSeconds > 0 ? "default" : "pointer",
              opacity: resendPending || resendCooldownSeconds > 0 ? 0.6 : 1,
              marginTop: 6,
            }}
          >
            {resendPending && <span className="gp-spinner-sm" aria-hidden />}
            {resendPending
              ? "Sende…"
              : resendCooldownSeconds > 0
              ? `Erneut in ${resendCooldownSeconds}s`
              : "Link senden"}
          </button>
        </form>

        <p style={{ marginTop: 18, textAlign: "center", fontSize: "0.8125rem", color: "var(--c-n400)" }}>
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
            ← Zurück zum Login
          </button>
        </p>
      </div>
    );
  }

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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: "var(--c-gold)" }}>
          <IconMail size={40} />
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
        <button
          type="button"
          onClick={() => setTab("login")}
          style={{
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            borderRadius: 8,
            border: "1px solid var(--c-n200)",
            background: "var(--c-surface)",
            color: "var(--c-ink)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Zurück zum Login
        </button>
        <p style={{ marginTop: 18, textAlign: "center", fontSize: "0.8125rem", color: "var(--c-n400)" }}>
          <button
            type="button"
            onClick={() => setTab("resend")}
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
            Kein Link erhalten? Erneut anfordern →
          </button>
        </p>
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
              color: tab === t ? "var(--c-bg)" : "var(--c-n500)",
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
        onSubmit={tab === "signup" ? handleSignupSubmit : undefined}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {tab === "signup" && (
          <Field
            label="Benutzername"
            name="username"
            autoComplete="username"
            placeholder="Philippe"
          />
        )}
        <Field
          label="E-Mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="philippe@guidephilippe.de"
          value={tab === "signup" ? signupEmail : undefined}
          onChange={tab === "signup" ? setSignupEmail : undefined}
        />
        {tab === "signup" && (
          <Field
            label="E-Mail bestätigen"
            name="emailConfirm"
            type="email"
            autoComplete="off"
            placeholder="philippe@guidephilippe.de"
            value={signupEmailConfirm}
            onChange={setSignupEmailConfirm}
            error={emailMismatch ? "Stimmt nicht mit der E-Mail-Adresse überein." : undefined}
            inputRef={emailConfirmRef}
          />
        )}
        <Field
          label="Passwort"
          name="password"
          type="password"
          autoComplete={tab === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          value={tab === "signup" ? signupPassword : undefined}
          onChange={tab === "signup" ? setSignupPassword : undefined}
        />
        {tab === "signup" && (
          <Field
            label="Passwort bestätigen"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={signupPasswordConfirm}
            onChange={setSignupPasswordConfirm}
            error={passwordMismatch ? "Stimmt nicht mit dem Passwort überein." : undefined}
            inputRef={passwordConfirmRef}
          />
        )}

        {tab === "login" && (
          <button
            type="button"
            onClick={() => setTab("forgot")}
            style={{
              alignSelf: "flex-end",
              background: "none",
              border: "none",
              color: "var(--c-n400)",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              cursor: "pointer",
              padding: 0,
              marginTop: -6,
            }}
          >
            Passwort vergessen?
          </button>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
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
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
            marginTop: 6,
            transition: "background 0.2s, transform 0.18s",
          }}
        >
          {isPending && <span className="gp-spinner-sm" aria-hidden />}
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

      <p
        style={{
          marginTop: 8,
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--c-n400)",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("resend")}
          style={{
            background: "none",
            border: "none",
            color: "var(--c-n400)",
            fontSize: "0.75rem",
            fontFamily: "inherit",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Bestätigungslink nicht erhalten oder abgelaufen?
        </button>
      </p>
    </div>
  );
}
