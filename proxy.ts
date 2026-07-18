import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

// Directives follow Google's official "Strict CSP" guidance for the Maps
// JavaScript API (developers.google.com/maps/documentation/javascript/content-security-policy):
// 'strict-dynamic' + a per-request nonce lets our own nonce'd/framework
// scripts load the Maps JS SDK's dynamically-injected <script src="https://maps.googleapis.com/...">
// tag without allowlisting that domain by name; 'unsafe-eval'/blob: are
// required by the SDK itself, not something this app's own code needs.
// style-src keeps 'unsafe-inline' (no nonce) on purpose — this app uses
// inline `style={{...}}` attributes throughout (see CLAUDE.md "Dark Mode"),
// and CSP nonces cannot apply to style="" attributes, only to <style>
// elements. Adding a nonce to style-src would silently invalidate
// 'unsafe-inline' for every one of those attributes and break the app's
// entire visual design.
function buildCsp(nonce: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-eval' blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' ${supabaseUrl} https://*.googleapis.com https://*.google.com https://*.gstatic.com;
    frame-src https://*.google.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  return csp.replace(/\s{2,}/g, " ").trim();
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // updateSession() forwards nonce/csp into headers().get("x-nonce") for
  // Server Components (see app/layout.tsx) and sets the response header.
  const response = await updateSession(request, nonce, csp);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all paths except static assets and Next.js internals.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
