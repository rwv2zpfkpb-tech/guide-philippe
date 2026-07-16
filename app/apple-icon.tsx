import { ImageResponse } from "next/og";
import { gpMarkElement } from "@/lib/pwa-icon";

// iOS "Add to Home Screen" reads this exact convention automatically (Next
// injects the <link rel="apple-touch-icon"> tag) — 180×180 is Apple's
// recommended size.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(gpMarkElement(size.width), { ...size });
}
