import { Resend } from "resend";

// Server-only — used by the Supabase Send Email Hook route handler.
// Factory instead of a module-level instance: the Resend constructor throws
// immediately if the API key is missing, which would break the build/module
// load before the route handler even runs.
export const getResendClient = () => new Resend(process.env.RESEND_API_KEY!);

export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Guide Philippe <onboarding@resend.dev>";
