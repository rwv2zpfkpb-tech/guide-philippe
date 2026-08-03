"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_LIBRARIES = ["places"] as ("places")[];

/**
 * One stable Google Maps loader per interactive surface. Keeping search and
 * map below the same provider prevents duplicate loader state and ensures the
 * Places library is ready before LocationSearch asks for it.
 */
export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={GOOGLE_MAPS_LIBRARIES}
      language="de"
      region="DE"
    >
      {children}
    </APIProvider>
  );
}
