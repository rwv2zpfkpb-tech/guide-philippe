"use client";

import { IconCompass } from "@/components/icons";

interface NavigateButtonProps {
  name: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
}

// Mobil: öffnet die native Karten-App des Geräts (Apple Maps auf iOS, sonst
// Google Maps/Karten-Auswahl via geo:-URI auf Android) direkt in der
// Navigationsansicht. Desktop: kein Navigations-Client vorhanden, daher
// Google Maps im Browser mit vorausgefüllter Route.
function openNavigation(name: string, lat: number, lng: number, googlePlaceId: string | null) {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const label = encodeURIComponent(name);

  if (isIOS) {
    window.location.href = `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
    return;
  }

  if (isAndroid) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    return;
  }

  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
  });
  if (googlePlaceId) params.set("destination_place_id", googlePlaceId);
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

export function NavigateButton({ name, lat, lng, googlePlaceId }: NavigateButtonProps) {
  return (
    <button
      type="button"
      onClick={() => openNavigation(name, lat, lng, googlePlaceId)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        fontSize: "0.875rem",
        fontWeight: 500,
        padding: "12px 22px",
        borderRadius: 9999,
        border: "none",
        background: "var(--c-burg)",
        color: "white",
        cursor: "pointer",
        boxShadow: "var(--s-sm)",
        whiteSpace: "nowrap",
      }}
    >
      <IconCompass size={16} />
      Route planen
    </button>
  );
}
