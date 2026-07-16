import { ImageResponse } from "next/og";
import { gpMarkElement } from "@/lib/pwa-icon";

// Dedicated route (rather than app/icon.tsx, which only serves one size) so
// app/manifest.ts can reference a 192×192 PNG for Android home-screen icons.
export async function GET() {
  return new ImageResponse(gpMarkElement(192), { width: 192, height: 192 });
}
