import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NavigationProgress from "@/components/NavigationProgress";
import { HeaderHeightObserver } from "@/components/HeaderHeightObserver";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guide Philippe",
  description: "Restaurant-Guide von Philippe",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Guide Philippe",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the user's saved theme from the cookie (set by ThemeToggle on the client).
  // When no cookie exists, omit the attribute so the CSS @media query handles
  // the system preference automatically — no JavaScript needed.
  const cookieStore = await cookies();
  const saved = cookieStore.get("gp-theme")?.value;
  const dataTheme = saved === "dark" || saved === "light" ? saved : undefined;

  // Set by proxy.ts on every request (Content-Security-Policy nonce) — this
  // inline <script> below is the only hand-authored inline script in the
  // app and needs it explicitly; Next.js applies the nonce automatically to
  // its own framework/chunk scripts, but not to raw dangerouslySetInnerHTML.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="de"
      className={`${cormorant.variable} ${dmSans.variable} h-full`}
      // data-theme set server-side → no flicker, no hydration script needed.
      // suppressHydrationWarning because the client ThemeToggle may update
      // the attribute without React knowing.
      {...(dataTheme ? { "data-theme": dataTheme } : {})}
      suppressHydrationWarning
    >
      <head>
        {/*
          Inline CSS — critical theme variables are part of the HTML response itself.
          This means they are always available before globals.css loads (or if it fails).
          globals.css loads later and redefines the same values, so there is no conflict.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
:root{color-scheme:light dark;--c-bg:oklch(97.5% 0.008 78);--c-surface:white;--c-ink:oklch(13% 0.012 255);--c-burg:oklch(31% 0.080 17);--c-burg-light:oklch(93% 0.016 17);--c-gold:oklch(58% 0.070 72);--c-gold-light:oklch(91% 0.032 76);--c-gold-mid:oklch(72% 0.050 74);--c-n50:oklch(95.5% 0.006 78);--c-n100:oklch(92% 0.007 78);--c-n200:oklch(86% 0.008 78);--c-n300:oklch(76% 0.008 78);--c-n400:oklch(63% 0.007 78);--c-n500:oklch(52% 0.007 78);--c-n600:oklch(41% 0.007 78);--c-n700:oklch(30% 0.008 78);--hero-from:oklch(90% 0.024 17);--hero-mid:oklch(95% 0.014 17)}
:root[data-theme=dark]{color-scheme:dark;--c-bg:oklch(12% 0.022 30);--c-surface:oklch(18% 0.022 30);--c-ink:oklch(93% 0.006 78);--c-burg:oklch(57% 0.080 17);--c-burg-light:oklch(20% 0.030 17);--c-gold:oklch(68% 0.070 72);--c-gold-light:oklch(22% 0.025 76);--c-gold-mid:oklch(56% 0.050 74);--c-n50:oklch(16% 0.018 30);--c-n100:oklch(22% 0.018 30);--c-n200:oklch(30% 0.014 35);--c-n300:oklch(41% 0.008 78);--c-n400:oklch(55% 0.007 78);--c-n500:oklch(67% 0.007 78);--c-n600:oklch(79% 0.006 78);--c-n700:oklch(88% 0.006 78);--hero-from:oklch(18% 0.028 17);--hero-mid:oklch(14% 0.022 22)}
:root[data-theme=light]{color-scheme:light;--c-bg:oklch(97.5% 0.008 78);--c-surface:white;--c-ink:oklch(13% 0.012 255);--c-burg:oklch(31% 0.080 17);--c-burg-light:oklch(93% 0.016 17);--c-gold:oklch(58% 0.070 72);--c-gold-light:oklch(91% 0.032 76);--c-gold-mid:oklch(72% 0.050 74);--c-n50:oklch(95.5% 0.006 78);--c-n100:oklch(92% 0.007 78);--c-n200:oklch(86% 0.008 78);--c-n300:oklch(76% 0.008 78);--c-n400:oklch(63% 0.007 78);--c-n500:oklch(52% 0.007 78);--c-n600:oklch(41% 0.007 78);--c-n700:oklch(30% 0.008 78);--hero-from:oklch(90% 0.024 17);--hero-mid:oklch(95% 0.014 17)}
html,body{background:var(--c-bg);color:var(--c-ink)}
        `}} />
        {/* Sets data-theme before CSS loads — inline script + inline style work together.
            suppressHydrationWarning: React deliberately reports the nonce attribute as ""
            on the client (so it can't be read via XSS/DOM scraping) even though the actual
            server-rendered HTML carries the real value the browser uses for CSP matching —
            an expected mismatch, not a bug. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){try{var c=document.cookie.match(/gp-theme=(dark|light)/);var t=c?c[1]:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})()` }} />
        <meta name="color-scheme" content={dataTheme ?? "light dark"} />
      </head>
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        <HeaderHeightObserver />
        <ServiceWorkerRegister />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
