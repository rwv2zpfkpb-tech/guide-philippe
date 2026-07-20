import { Webhook } from "standardwebhooks";
import { getResendClient, RESEND_FROM_EMAIL } from "@/lib/resend";
import { renderAuthEmail, type AuthEmailActionType } from "@/lib/auth-emails";

export const runtime = "nodejs";

// Supabase "Send Email" auth hook — Supabase calls this on every auth e-mail
// (signup, magic link, recovery, ...) instead of sending it itself. We verify
// the Standard Webhooks signature, then ship the e-mail through Resend.
// Configure in Supabase Dashboard → Authentication → Hooks → Send Email Hook,
// pointing at this route's URL, using SEND_EMAIL_HOOK_SECRET as the secret.

type SendEmailHookPayload = {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailActionType;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
};

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: { http_code: status, message } }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET?.replace(/^v1,/, "");
  if (!hookSecret) {
    return errorResponse(500, "SEND_EMAIL_HOOK_SECRET is not configured");
  }
  if (!process.env.RESEND_API_KEY) {
    return errorResponse(500, "RESEND_API_KEY is not configured");
  }

  let data: SendEmailHookPayload;
  try {
    const wh = new Webhook(hookSecret);
    data = wh.verify(payload, headers) as SendEmailHookPayload;
  } catch {
    return errorResponse(401, "Invalid webhook signature");
  }

  const { user, email_data } = data;
  const { token, token_hash, token_hash_new, redirect_to, email_action_type } = email_data;

  // Points straight at our own confirm/reset-password page with the raw
  // `token_hash` (+ `type`) instead of GoTrue's hosted `/auth/v1/verify`
  // endpoint. GoTrue's endpoint verifies (and thereby *consumes*) the token
  // on a plain GET — which e-mail security scanners (Outlook Safe Links,
  // corporate mail gateways, etc.) happily trigger themselves while
  // prefetching/scanning the mail, invalidating the link before the actual
  // user ever clicks it. Our own pages instead only call
  // `supabase.auth.verifyOtp({ token_hash, type })` from a Server Action
  // fired by an explicit user click/submit (app/actions/auth.ts:
  // confirmEmailToken / updatePassword) — scanners fetch the page itself but
  // never click the button or submit the form, so the token survives until
  // the real user acts on it.
  const separator = redirect_to.includes("?") ? "&" : "?";
  const confirmationURL = `${redirect_to}${separator}token_hash=${encodeURIComponent(
    email_action_type === "email_change" ? token_hash_new || token_hash : token_hash
  )}&type=${encodeURIComponent(email_action_type)}`;

  const { subject, html } = renderAuthEmail(email_action_type, {
    confirmationURL,
    token,
  });

  const { error } = await getResendClient().emails.send({
    from: RESEND_FROM_EMAIL,
    to: [user.email],
    subject,
    html,
  });

  if (error) {
    return errorResponse(500, error.message);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
