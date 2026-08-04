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

export function InstallPwaInstructions() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const dismissed = localStorage.getItem("gp-install-hint-dismissed") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detected);
    setVisible((detected === "ios" || detected === "android") && !installed && !dismissed);
  }, []);

  if (!visible || platform === "other") return null;

  const dismiss = () => {
    localStorage.setItem("gp-install-hint-dismissed", "1");
    setVisible(false);
  };

  const title = platform === "ios" ? "Auf iPhone oder iPad installieren" : "Auf Android installieren";

  return (
    <section className="gp-install-hint" aria-labelledby="gp-install-title">
      <div className="gp-install-hint-heading">
        <div>
          <h2 id="gp-install-title">{title}</h2>
          <p>Schneller Zugriff direkt vom Homescreen.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Installationshinweis ausblenden">×</button>
      </div>
      <details>
        <summary>Anleitung anzeigen</summary>
        <ol>
          {STEPS[platform].map((step, i) => (
            <li key={step}><span>{i + 1}</span><p>{step}</p></li>
          ))}
        </ol>
      </details>
    </section>
  );
}
