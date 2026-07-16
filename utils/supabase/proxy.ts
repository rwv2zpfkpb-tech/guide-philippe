import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Routes reachable without being logged in / approved.
// - /login, /auth/confirm, /auth/reset-password: the auth flow itself
//   (reset-password must stay public — its PKCE `code` exchange runs before
//   any session cookie exists, so gating it would bounce the recovery link
//   straight to /login and drop the code query param)
// - /pending: screen shown to logged-in-but-not-yet-approved accounts
// - /api/auth/email: Supabase's Send Email Hook calls this server-to-server
//   (no user session) — redirecting it to /login would break every auth mail.
// - /manifest.webmanifest, /icon, /apple-icon, /icons/*: PWA metadata — the
//   browser tab favicon must render on /login itself, and Chrome/Safari need
//   to fetch these to offer "Add to Home Screen" even before the user signs in.
const PUBLIC_PATHS = [
  "/login",
  "/auth/confirm",
  "/auth/reset-password",
  "/pending",
  "/api/auth/email",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/icons",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(request: NextRequest, path: string, cookieSource: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const response = NextResponse.redirect(url);
  cookieSource.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

// Refreshes the Supabase session on every request and gates access:
// visitors are redirected to /login, logged-in accounts that aren't
// yet approved by an admin are redirected to /pending.
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: calling getUser() is what triggers the token refresh.
  // Do not remove this line.
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    return redirectTo(request, "/login", supabaseResponse);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status !== "approved") {
    return redirectTo(request, "/pending", supabaseResponse);
  }

  return supabaseResponse;
};
