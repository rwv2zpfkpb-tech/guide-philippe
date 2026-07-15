// Templates for the Supabase "Send Email" auth hook — every transactional
// auth e-mail (signup, magic link, password recovery, ...) is rendered here
// and shipped through Resend instead of Supabase's built-in mailer.

export type AuthEmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

type AuthEmailCopy = {
  subject: string;
  heading: string;
  body: string;
  cta: string;
};

const COPY: Record<AuthEmailActionType, AuthEmailCopy> = {
  signup: {
    subject: "Bestätige dein Konto bei Guide Philippe",
    heading: "Willkommen bei Guide Philippe",
    body: "Schön, dass du dabei bist. Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
    cta: "Konto bestätigen",
  },
  invite: {
    subject: "Du wurdest zu Guide Philippe eingeladen",
    heading: "Du bist eingeladen",
    body: "Jemand hat dich zu Guide Philippe eingeladen. Klicke auf den Button, um dein Konto einzurichten.",
    cta: "Einladung annehmen",
  },
  magiclink: {
    subject: "Dein Login-Link für Guide Philippe",
    heading: "Anmelden",
    body: "Klicke auf den Button, um dich ohne Passwort bei Guide Philippe anzumelden.",
    cta: "Jetzt anmelden",
  },
  recovery: {
    subject: "Setze dein Passwort zurück",
    heading: "Passwort zurücksetzen",
    body: "Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu vergeben.",
    cta: "Passwort zurücksetzen",
  },
  email_change: {
    subject: "Bestätige deine neue E-Mail-Adresse",
    heading: "E-Mail-Adresse ändern",
    body: "Bitte bestätige, dass diese E-Mail-Adresse mit deinem Guide-Philippe-Konto verknüpft werden soll.",
    cta: "Änderung bestätigen",
  },
  reauthentication: {
    subject: "Dein Sicherheitscode für Guide Philippe",
    heading: "Sicherheitsbestätigung",
    body: "Bitte gib den folgenden Code ein, um die Aktion zu bestätigen.",
    cta: "",
  },
};

const COLORS = {
  bg: "#f7f4ee",
  surface: "#ffffff",
  ink: "#1c1b1f",
  gold: "#b08a4e",
  burg: "#5c2a28",
  muted: "#767370",
  border: "#ded9d0",
};

function layout(inner: string) {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:32px 16px;background:${COLORS.bg};font-family:Georgia,'Times New Roman',serif;color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:${COLORS.surface};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:36px 36px 28px;">
          <div style="font-size:15px;font-weight:700;letter-spacing:-0.01em;margin-bottom:24px;font-family:Georgia,serif;">
            Guide <span style="color:${COLORS.burg};">Philippe</span>
          </div>
          ${inner}
        </td>
      </tr>
    </table>
    <p style="max-width:480px;margin:20px auto 0;padding:0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center;">
      Diese E-Mail wurde automatisch von Guide Philippe verschickt. Wenn du das nicht warst, kannst du sie ignorieren.
    </p>
  </body>
</html>`;
}

export function renderAuthEmail(
  actionType: AuthEmailActionType,
  params: { confirmationURL: string; token?: string }
): { subject: string; html: string } {
  const copy = COPY[actionType];

  if (actionType === "reauthentication") {
    return {
      subject: copy.subject,
      html: layout(`
        <div style="font-size:22px;font-weight:500;margin-bottom:12px;">${copy.heading}</div>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted};margin:0 0 24px;">
          ${copy.body}
        </p>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;letter-spacing:0.2em;color:${COLORS.ink};background:${COLORS.bg};border-radius:10px;padding:16px;text-align:center;">
          ${params.token ?? ""}
        </div>
      `),
    };
  }

  return {
    subject: copy.subject,
    html: layout(`
      <div style="font-size:22px;font-weight:500;margin-bottom:12px;">${copy.heading}</div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted};margin:0 0 28px;">
        ${copy.body}
      </p>
      <a href="${params.confirmationURL}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:500;color:${COLORS.surface};background:${COLORS.ink};padding:13px 26px;border-radius:8px;text-decoration:none;">
        ${copy.cta}
      </a>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.muted};margin:24px 0 0;word-break:break-all;">
        Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
        <a href="${params.confirmationURL}" style="color:${COLORS.gold};">${params.confirmationURL}</a>
      </p>
    `),
  };
}
