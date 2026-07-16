"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const STEPS: Record<"ios" | "android", string[]> = {
  ios: [
    "Öffne Guide Philippe in Safari.",
    "Tippe unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben).",
    "Wähle „Zum Home-Bildschirm“ und bestätige mit „Hinzufügen“.",
  ],
  android: [
    "Öffne Guide Philippe in Chrome.",
    "Tippe oben rechts auf das Menü (⋮).",
    "Wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.",
  ],
};

// Purely informational — no beforeinstallprompt handling, just tailored
// step-by-step instructions with the detected platform highlighted first.
export function InstallPwaInstructions() {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
  }, []);

  const order: ("ios" | "android")[] =
    platform === "android" ? ["android", "ios"] : ["ios", "android"];

  return (
    <section style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 40px 72px" }}>
      <div style={{ borderTop: "1px solid var(--c-n100)", paddingTop: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.75rem",
              fontWeight: 600,
              color: "var(--c-ink)",
              marginBottom: 8,
            }}
          >
            Als App installieren
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--c-n500)", maxWidth: 480, margin: "0 auto" }}>
            Guide Philippe lässt sich auf dem Homescreen installieren — schneller Zugriff, wie eine native App.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          {order.map((p) => (
            <div
              key={p}
              style={{
                borderRadius: 16,
                border: `1px solid ${platform === p ? "var(--c-gold)" : "var(--c-n100)"}`,
                background: platform === p ? "var(--c-gold-light)" : "var(--c-surface)",
                padding: "22px 24px",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "var(--c-ink)",
                  marginBottom: 14,
                }}
              >
                {p === "ios" ? "iPhone / iPad (Safari)" : "Android (Chrome)"}
              </h3>
              <ol style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.8125rem", color: "var(--c-n600)", lineHeight: 1.5 }}>
                {STEPS[p].map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 10 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--c-ink)",
                        color: "var(--c-bg)",
                        fontSize: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
