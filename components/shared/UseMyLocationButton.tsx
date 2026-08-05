"use client";

import { useState } from "react";
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

  const message =
    status === "denied"
      ? "Location permission was denied — no problem, you can keep using the city and area dropdowns instead."
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
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={`inline-flex items-center gap-1.5 font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 ${
          compact ? "text-sm" : "text-sm"
        }`}
      >
        <span aria-hidden="true">📍</span>
        {status === "loading" ? "Finding your location…" : label}
      </button>

      {message && (
        <p className="absolute left-0 top-full z-10 mt-1.5 w-64 rounded-lg bg-white px-2.5 py-1.5 text-sm text-slate-500 shadow-md">
          {message}
        </p>
      )}
      {!compact && !message && (
        <p className="absolute left-0 top-full mt-1.5 w-64 text-xs text-slate-400">
          {DEFAULT_PRIVACY_NOTE}
        </p>
      )}
    </div>
  );
}
