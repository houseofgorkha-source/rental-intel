import type { Coordinates } from "@/lib/area-coordinates";

export type GeolocationResult =
  | { status: "granted"; coordinates: Coordinates }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

// Thin, reusable wrapper around the browser Geolocation API. Never called
// automatically — every caller only invokes this in direct response to a
// user clicking a "Use my location" control. Coordinates never leave the
// browser: no reverse-geocoding service (Nominatim, Google, or otherwise)
// is called here or anywhere in this codebase — see lib/area-coordinates.ts
// for the nearest-city/area lookup this feeds into instead.
export function requestCurrentLocation(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "granted",
          coordinates: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: "denied" });
          return;
        }
        resolve({ status: "error", message: error.message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
