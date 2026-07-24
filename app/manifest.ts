import type { MetadataRoute } from "next";

// Served automatically at /manifest.webmanifest by the Next.js file
// convention. background_color/theme_color match the auth-email hex
// palette (lib/auth-emails.ts) — the same brand colors used wherever CSS
// custom properties aren't available.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Guide Philippe",
    short_name: "Guide Philippe",
    description: "Ein ehrlicher, kuratierter Restaurant-Guide.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#5c2a28",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
