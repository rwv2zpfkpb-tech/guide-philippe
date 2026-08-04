"use client";

/* eslint-disable @next/next/no-img-element -- Google Places returns short-lived,
 * already resized CDN URLs; proxying them through Next adds no useful
 * optimization and previously caused the detail hero to collapse. */

import { useEffect, useRef, useState } from "react";

type RestaurantPhotoProps = {
  src: string;
  alt: string;
  variant: "hero" | "thumbnail";
};

/**
 * Makes Google Places photos repaint when their asynchronous decode finishes.
 *
 * Safari (especially in an installed PWA) can occasionally finish decoding a
 * cross-origin image inserted by a streamed navigation without painting it
 * until an unrelated style change occurs. Tracking both the native load event
 * and the already-cached `complete` state gives the browser an explicit visual
 * update in either case.
 */
export function RestaurantPhoto({ src, alt, variant }: RestaurantPhotoProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return;

    // Covers cached images which completed before React attached `onLoad`.
    setReady(true);
  }, [src]);

  const isHero = variant === "hero";

  // Google returns already resized, short-lived CDN URLs. Keep the browser
  // request direct rather than sending it through the Next image optimizer.
  // Explicit intrinsic dimensions also give WebKit stable layout information
  // before the remote file has decoded.
  return (
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      width={isHero ? 1200 : 60}
      height={isHero ? 450 : 48}
      loading="eager"
      decoding="async"
      fetchPriority={isHero ? "high" : "auto"}
      onLoad={() => setReady(true)}
      onError={() => setReady(true)}
      style={isHero ? {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        opacity: ready ? 1 : 0,
        willChange: ready ? "auto" : "opacity",
        transition: "opacity 160ms ease",
      } : {
        width: 60,
        height: 48,
        objectFit: "cover",
        display: "block",
        borderRadius: 6,
        border: "2px solid white",
        boxShadow: "var(--s-sm)",
        opacity: ready ? 1 : 0,
        willChange: ready ? "auto" : "opacity",
        transition: "opacity 160ms ease",
      }}
    />
  );
}
