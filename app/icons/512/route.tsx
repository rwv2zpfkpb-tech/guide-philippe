import { ImageResponse } from "next/og";
import { gpMarkElement } from "@/lib/pwa-icon";

// Dedicated route (rather than app/icon.tsx, which only serves one size) so
// app/manifest.ts can reference a 512×512 PNG (incl. maskable) for Android.
export async function GET() {
  return new ImageResponse(gpMarkElement(512), { width: 512, height: 512 });
}
