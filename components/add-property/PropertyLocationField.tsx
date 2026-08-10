"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "@/components/property/PropertyMap";
import UseMyLocationButton from "@/components/shared/UseMyLocationButton";
import { geocodeAddress } from "@/lib/geocoding";
import type { Coordinates } from "@/lib/area-coordinates";

type PropertyLocationFieldProps = {
  // Prefilled when amending a property that already has a confirmed exact
  // pin. Absent (or null) on the Add Property form, and on Edit until the
  // contributor has confirmed one.
  defaultCoordinates?: Coordinates | null;
  // Where to show the marker before anything has been geocoded or picked --
  // the area or city centroid, same lookup the rest of the app already uses.
  // Never treated as a real pin on its own.
  fallbackCenter: Coordinates;
  // The most complete address currently available, kept as separate parts
  // (rather than one pre-joined string) so geocodeAddress can try
  // progressively broader combinations and validate each result against
  // area/city itself. On the Add form these change as the contributor types
  // (debounced here); on Edit, where address fields are frozen (§26 identity
  // immutability -- this component never unlocks them), they're static
  // values computed once. Either way, geocoding only ever repositions the
  // UNCONFIRMED marker -- never submitted until the viewer explicitly
  // confirms a point themselves.
  addressLine1?: string;
  addressLine2?: string;
  area: string;
  city: string;
};

const PICKER_ZOOM = 15;
// A muted, unconfirmed color for a guessed/fallback position, and the app's
// real accent once the viewer has actually set a pin -- so "this is our best
// guess" and "this is the property's confirmed pin" never look the same.
const UNCONFIRMED_COLOR = "#8a8a8a";
const CONFIRMED_COLOR = "#0e8f5e";
const GEOCODE_DEBOUNCE_MS = 800;

// The Add/Edit Property pin picker. A single marker on a small MapLibre map,
// reusing the same OSM style PropertyMap.tsx renders (imported, not
// duplicated) and the same UseMyLocationButton/geolocation plumbing the rest
// of the app already uses. Two coordinates are tracked, deliberately kept
// separate:
//   - `displayPosition`: wherever the marker currently sits, including an
//     auto-geocoded guess from the typed address. Always present, purely
//     visual, never submitted on its own.
//   - `confirmedCoordinates`: null until the viewer clicks the map, drags the
//     marker, or uses "Use my current location" -- only this is written to
//     the hidden inputs the form actually submits.
// Once confirmed, further address geocoding is skipped entirely: a viewer
// who has deliberately placed a pin should never have it silently yanked
// away by a later auto-guess.
export default function PropertyLocationField({
  defaultCoordinates = null,
  fallbackCenter,
  addressLine1,
  addressLine2,
  area,
  city,
}: PropertyLocationFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [confirmedCoordinates, setConfirmedCoordinates] = useState<Coordinates | null>(
    defaultCoordinates,
  );
  const [displayPosition, setDisplayPosition] = useState<Coordinates>(
    defaultCoordinates ?? fallbackCenter,
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isConfirmed = confirmedCoordinates !== null;
  // Read inside effects via a ref rather than the state directly, so the
  // debounced geocode effect (below) doesn't need `isConfirmed` in its
  // dependency array — it only needs the CURRENT answer at the moment its
  // timer fires, not to re-run every time confirmation changes.
  const isConfirmedRef = useRef(isConfirmed);
  isConfirmedRef.current = isConfirmed;

  // Mount the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startCenter = defaultCoordinates ?? fallbackCenter;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [startCenter.lng, startCenter.lat],
        zoom: PICKER_ZOOM,
        attributionControl: { compact: true },
      });
    } catch {
      setHasError(true);
      return;
    }
    map.on("error", () => setHasError(true));
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const marker = new Marker({
      draggable: true,
      color: defaultCoordinates ? CONFIRMED_COLOR : UNCONFIRMED_COLOR,
    })
      .setLngLat([startCenter.lng, startCenter.lat])
      .addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      setConfirmedCoordinates({ lat, lng });
      setDisplayPosition({ lat, lng });
    });

    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      setConfirmedCoordinates(point);
      setDisplayPosition(point);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recolors the marker the moment a pin is confirmed. MapLibre Markers
  // don't expose a color setter, so this is the one thing that requires
  // replacing the element rather than just moving it.
  useEffect(() => {
    if (!isConfirmed || !mapRef.current || !confirmedCoordinates) return;
    markerRef.current?.remove();
    markerRef.current = new Marker({ draggable: true, color: CONFIRMED_COLOR })
      .setLngLat([confirmedCoordinates.lng, confirmedCoordinates.lat])
      .addTo(mapRef.current);
    markerRef.current.on("dragend", () => {
      const { lat, lng } = markerRef.current!.getLngLat();
      setConfirmedCoordinates({ lat, lng });
      setDisplayPosition({ lat, lng });
    });
    // Fires once, on the transition to confirmed — not on every subsequent
    // drag of the now-already-green marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  // The auto-locate step (requirement flow, steps 1-3 and 7): debounced so
  // it fires once typing settles, not per keystroke, and skipped entirely
  // once a pin is confirmed (see isConfirmedRef above).
  useEffect(() => {
    if (isConfirmedRef.current) return;

    const timer = setTimeout(async () => {
      if (isConfirmedRef.current) return;

      setIsGeocoding(true);
      const resolved = await geocodeAddress({ addressLine1, addressLine2, area, city });
      setIsGeocoding(false);

      // Still unconfirmed by the time the request came back? Use it (or the
      // area/city fallback if every level of the query failed to match). If
      // the viewer confirmed a pin while this was in flight, their choice
      // wins — never overwritten.
      if (isConfirmedRef.current) return;

      const point = resolved ?? fallbackCenter;
      setDisplayPosition(point);
      markerRef.current?.setLngLat([point.lng, point.lat]);
      mapRef.current?.easeTo({ center: [point.lng, point.lat], zoom: PICKER_ZOOM });
    }, GEOCODE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // fallbackCenter intentionally excluded: it's recomputed by the parent
    // from area/city, which are already inputs to the geocode query, so
    // including it would just double-trigger the same lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressLine1, addressLine2, area, city]);

  function handleLocated(point: Coordinates) {
    setConfirmedCoordinates(point);
    setDisplayPosition(point);
    mapRef.current?.easeTo({ center: [point.lng, point.lat], zoom: PICKER_ZOOM });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Exact location on the map
      </label>
      <p className="text-sm text-muted">
        We&apos;ve placed a pin near the address you entered. Drag it, click
        the map, or use your current location to mark exactly where this
        property is — until then, it&apos;s just our best guess and won&apos;t
        be saved.
      </p>

      <UseMyLocationButton
        onLocated={handleLocated}
        compact
        label="Use my current location for this pin"
      />

      {hasError ? (
        <div className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-6 text-center text-sm text-muted">
          Map unavailable in this browser — you can still submit without an exact pin.
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-64 w-full overflow-hidden rounded-xl border border-border-subtle"
        />
      )}

      <p className="text-xs text-muted">
        {isConfirmed
          ? `Pin confirmed at ${displayPosition.lat.toFixed(5)}, ${displayPosition.lng.toFixed(5)}`
          : isGeocoding
            ? "Locating your address…"
            : "Not confirmed yet — showing our best guess for this address."}
      </p>

      <input type="hidden" name="latitude" value={confirmedCoordinates?.lat ?? ""} />
      <input type="hidden" name="longitude" value={confirmedCoordinates?.lng ?? ""} />
    </div>
  );
}
