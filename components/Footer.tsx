"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The search-results view (app/page.tsx, "/" with location params) renders its
// own fixed-height list/map layout that fills the viewport below the header —
// only its internal results list scrolls. Rendering the footer underneath it
// would push the page taller than 100vh and make the whole document scroll,
// so it's hidden for that specific view instead.
function FooterInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLocationSearch =
    pathname === "/" &&
    searchParams.has("lat") && searchParams.has("lng") &&
    searchParams.has("ne_lat") && searchParams.has("ne_lng") &&
    searchParams.has("sw_lat") && searchParams.has("sw_lng");

  if (isLocationSearch) return null;

  return (
    <footer
      style={{
        background: "var(--c-burg)",
        padding: "36px 40px",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "oklch(90% 0.018 17)",
          }}
        >
          Guide{" "}
          <span style={{ color: "white" }}>Philippe</span>.
        </div>

        <span
          style={{
            fontSize: "0.6875rem",
            color: "oklch(60% 0.020 17)",
            letterSpacing: "0.03em",
          }}
        >
          © {new Date().getFullYear()} Guide Philippe
        </span>
      </div>
    </footer>
  );
}

export default function Footer() {
  return (
    <Suspense>
      <FooterInner />
    </Suspense>
  );
}
