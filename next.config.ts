import type { NextConfig } from "next";

// Baseline hardening headers — the app previously shipped with none set at
// all. Content-Security-Policy is NOT set here: it needs a fresh nonce per
// request (for the one inline <script> in app/layout.tsx, plus Next's own
// framework scripts under 'strict-dynamic'), which next.config.ts's static
// headers() can't generate — see proxy.ts/utils/supabase/proxy.ts instead.
const securityHeaders = [
  // The app has no legitimate reason to be iframed elsewhere — blocks
  // clickjacking (e.g. an invisible iframe over the admin dashboard).
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers from MIME-sniffing responses into an executable type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry query params) to third-party
  // origins on outbound navigation/requests; same-origin still gets the
  // full referrer for analytics-less internal use.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in the app uses camera/mic/USB — deny by default. Geolocation is
  // allowed for same-origin only ("Standort verwenden" in LocationSearch.tsx,
  // via navigator.geolocation) — it was blanket-denied here before that
  // feature existed.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
