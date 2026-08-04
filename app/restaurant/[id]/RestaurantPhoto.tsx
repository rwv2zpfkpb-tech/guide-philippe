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

/** Fades a Google Places photo in after it has actually loaded. */
export function RestaurantPhoto({ src, alt, variant }: RestaurantPhotoProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return undefined;

    // A cached image may finish before React attaches `onLoad`. Waiting for
    // the next frame guarantees that the initial state has painted, so it
    // receives the same fade as a fresh network response.
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [src]);

  const isHero = variant === "hero";

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
        transform: ready ? "scale(1)" : "scale(1.012)",
        willChange: ready ? "auto" : "opacity, transform",
        transition: "opacity 320ms ease, transform 480ms cubic-bezier(0.16, 1, 0.3, 1)",
      } : {
        width: 60,
        height: 48,
        objectFit: "cover",
        display: "block",
        borderRadius: 6,
        border: "2px solid white",
        boxShadow: "var(--s-sm)",
        opacity: ready ? 1 : 0,
        transform: ready ? "scale(1)" : "scale(0.94)",
        willChange: ready ? "auto" : "opacity, transform",
        transition: "opacity 240ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    />
  );
}
