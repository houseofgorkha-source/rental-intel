"use client";

import { useEffect, useRef, useState } from "react";
import { requestCurrentLocation } from "@/lib/geolocation";
import type { Coordinates } from "@/lib/area-coordinates";

type UseMyLocationButtonProps = {
  onLocated: (coordinates: Coordinates) => void;
  label?: string;
  compact?: boolean;
  className?: string;
};

const DEFAULT_PRIVACY_NOTE =
  "We'll use your location only to help find nearby properties and suggest your city and area. Your precise location is never stored or shared.";

// Reusable across the homepage, Add Property, and Review flows. Location is
// only ever requested when this button is clicked — never automatically —
// and the resulting coordinates are handed to the caller's onLocated
// callback and nowhere else; this component never persists or transmits
// them anywhere itself.
export default function UseMyLocationButton({
  onLocated,
  label = "Use my current location",
  compact = false,
  className = "",
}: UseMyLocationButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "denied" | "unsupported" | "error">(
    "idle",
  );
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleClick() {
    setStatus("loading");
    const result = await requestCurrentLocation();

    if (result.status === "granted") {
      setStatus("idle");
      onLocated(result.coordinates);
      return;
    }

    setStatus(result.status === "error" ? "error" : result.status);
  }

  // The message stays open until the user dismisses it by clicking
  // elsewhere — it doesn't disappear on its own.
  useEffect(() => {
    if (status === "idle" || status === "loading") return;

    const dismiss = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setStatus("idle");
      }
    };

    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [status]);

  const message =
    status === "denied"
      ? "Location access is blocked for this site. To use it, turn it on in your browser: click the lock/site-settings icon next to the address bar, allow Location, then try again."
      : status === "unsupported"
        ? "Your browser doesn't support location detection here — use the dropdowns instead."
        : status === "error"
          ? "We couldn't detect your location. Please use the dropdowns instead."
          : null;

  return (
    // `relative` + absolutely-positioned message/note below: neither one is
    // ever in normal document flow, so this component's own height never
    // changes as status changes — it can't push sibling toolbar items
    // (search bar, filters) up or down regardless of how long the message is.
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={`inline-flex items-center gap-1.5 font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 ${
          compact ? "text-sm" : "text-sm"
        }`}
      >
        {/* A direction arrow, not a map pin. A pin marks a place someone
            else chose; this control points at where the user is right now,
            which is what every navigation app uses this shape to mean. */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 fill-none stroke-current stroke-[1.8] ${
            status === "loading" ? "animate-pulse" : ""
          }`}
        >
          <path d="M21 3 3 10.5l7.5 3 3 7.5L21 3Z" strokeLinejoin="round" />
        </svg>
        {status === "loading" ? "Finding your location…" : label}
      </button>

      {message && (
        <div className="absolute left-0 top-full z-10 mt-1.5 w-72 rounded-lg bg-white p-2.5 shadow-md">
          <p className="text-sm text-slate-500">{message}</p>
          {status !== "unsupported" && (
            <button
              type="button"
              onClick={handleClick}
              className="mt-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          )}
        </div>
      )}
      {!compact && !message && (
        <p className="absolute left-0 top-full mt-1.5 w-64 text-xs text-slate-400">
          {DEFAULT_PRIVACY_NOTE}
        </p>
      )}
    </div>
  );
}
