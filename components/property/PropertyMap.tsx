"use client";

import { useEffect, useRef, useState } from "react";
import { OlaMaps, defaultStyleJson } from "olamaps-web-sdk";
import type {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  GeoJSONSource,
  StyleSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatINRPerMonth } from "@/lib/property-format";
import type { DiscoveryProperty } from "@/lib/property-discovery";
import type { Coordinates } from "@/lib/area-coordinates";

type PropertyMapProps = {
  properties: DiscoveryProperty[];
  center: Coordinates;
  zoom: number;
  selectedSlug: string | null;
  onSelectProperty: (slug: string | null) => void;
  // Set (to a fresh object, even for the same slug twice in a row — see
  // HomeDiscovery) when a property card is actually clicked, as opposed to
  // hovered/focused. Opens that marker's popup, the same one clicking the
  // marker itself would open, so a card click and a marker click land on
  // the exact same result.
  popupRequest?: { slug: string; token: number } | null;
  // The browser's actual reported position (see lib/geolocation.ts) — real
  // GPS/network coordinates, never an area or city centroid. Renders a
  // distinct "you are here" marker, separate from property pins. Null
  // whenever nothing has been located yet, or the user has since navigated
  // away from it (see HomeDiscovery).
  userLocation?: Coordinates | null;
  // Fires once the user finishes moving the map (drag/zoom end) — reports
  // the resulting view without feeding it back into `center`/`zoom`, so
  // dragging never triggers a city/area change on its own. This is exactly
  // the hook a future "Search this area" button would read from.
  onMoveEnd?: (view: { center: Coordinates; zoom: number }) => void;
};

// OpenStreetMap's standard raster tiles — no Mapbox/Google, no API key.
// Exported for reuse by PropertyLocationField (the Add/Edit Property pin
// picker) so the two maps can never end up on different tile styles.
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

// Ola Maps foundation — shared by every live map in the app (this component
// and the To-Let spotted-boards preview map). Deliberately centralized here
// rather than each map constructing its own OlaMaps client/style, so the two
// can never drift onto different styles or key-handling logic (mirrors why
// OSM_STYLE above was already exported for PropertyLocationField).
//
// `defaultStyleJson` is the SDK's own published default style URL (not
// hand-rolled) — see olamaps-web-sdk's exported constant. `pitch`/`bearing`
// give the tilted, building-extrusion "3D" look on top of it; MapLibre (which
// this SDK wraps) renders 3D buildings from a non-zero pitch whenever the
// active style defines them, which this default style does at street level.
export const OLA_STYLE_URL = defaultStyleJson;
export const OLA_MAP_VIEW_DEFAULTS = { pitch: 45, bearing: -10 } as const;

let olaMapsClient: OlaMaps | null = null;
// Lazily constructed, not module-scope-eager — avoids throwing on import in
// any environment (tests, SSR) where NEXT_PUBLIC_OLA_MAPS_API_KEY isn't set,
// and where a component using this never actually mounts. Stateless per the
// SDK's own design (the returned client only holds the key/config used by
// its own init()/addMarker()/addPopup() calls), so one shared instance is
// safe to reuse across every map on the page.
export function getOlaMapsClient(): OlaMaps {
  if (olaMapsClient) return olaMapsClient;
  const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_OLA_MAPS_API_KEY is not set. Copy .env.example to .env and set it to a Web SDK key from the Krutrim Cloud dashboard -- never the crawler's server-side OLA_MAPS_API_KEY, which would expose that budget-tracked key to every visitor's browser."
    );
  }
  olaMapsClient = new OlaMaps({ apiKey });
  return olaMapsClient;
}

const SOURCE_ID = "properties";

// Proactive check, ahead of even attempting to construct MapLibreMap — a
// throwaway canvas that requests a webgl2 context. If the browser can't
// grant one, there's no point constructing the map at all; we already know
// it will fail. Kept separate from the try/catch around construction below
// (defense in depth, not a replacement for it) since some environments can
// pass this check yet still fail during actual map setup for other reasons
// (driver bugs, context loss, etc).
function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function toGeoJSON(properties: DiscoveryProperty[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: properties
      .filter((property) => property.coordinates !== null)
      .map((property) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [property.coordinates!.lng, property.coordinates!.lat],
        },
        properties: {
          slug: property.slug,
          name: property.name,
          area: property.area,
          city: property.city,
          rent: property.askingRent,
        },
      })),
  };
}

// Shared by marker-click and card-click popups so the two can never drift
// into showing different content for the same property. `area`/`city` is
// the only location text this schema has to offer here -- the marker itself
// sits at the area's centroid, not a geocoded street address (see
// lib/area-coordinates.ts), so showing a precise address next to an
// approximate pin would overclaim precision the map doesn't have.
function buildPopupNode(
  name: string,
  area: string,
  city: string,
  rent: number | null,
  slug: string,
): HTMLDivElement {
  const node = document.createElement("div");
  node.className = "text-sm";
  const title = document.createElement("p");
  title.className = "font-medium text-foreground";
  title.textContent = name;
  const addressLine = document.createElement("p");
  addressLine.className = "mt-0.5 text-xs uppercase tracking-wide text-muted";
  addressLine.textContent = `${area}, ${city}`;
  const rentLine = document.createElement("p");
  rentLine.className = "mt-1 text-muted";
  rentLine.textContent = rent === null ? "Rent on request" : formatINRPerMonth(rent);
  const link = document.createElement("a");
  link.href = `/property/${slug}`;
  link.textContent = "View property →";
  link.className = "mt-1.5 inline-block font-medium text-accent hover:underline";
  node.append(title, addressLine, rentLine, link);
  return node;
}

export default function PropertyMap({
  properties,
  center,
  zoom,
  selectedSlug,
  onSelectProperty,
  popupRequest,
  userLocation,
  onMoveEnd,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  // Shared across a React Strict Mode dev double-invoke of the init effect
  // below (mount -> cleanup -> mount, synchronously, before olaMaps.init()'s
  // promise can resolve) — see that effect's own comment for why a second,
  // independent init() call on the same container was observed (via
  // browser testing) to abort both instances' style/tile requests, leaving
  // the map permanently blank in dev.
  const initPromiseRef = useRef<Promise<MapLibreMap> | null>(null);
  const initTokenRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);
  // MapLibre requires WebGL2 and throws (synchronously from the constructor,
  // or asynchronously via an "error" event) when it's unavailable —
  // disabled/unsupported browsers, some sandboxed/virtualized environments,
  // GPU access blocked, etc. This must never crash the whole homepage; the
  // rest of the discovery panel (search, filters, property list) still
  // works perfectly well without a map.
  const [hasError, setHasError] = useState(false);

  // The init effect below registers its click/moveend handlers exactly once
  // and never re-registers them, so it must never call onSelectProperty/
  // onMoveEnd directly (that would close over whichever reference existed
  // at mount and use it forever). Routing every call through these refs,
  // kept current on every render, makes the handlers correct regardless of
  // whether a future caller passes a stable or freshly-created callback.
  const onSelectPropertyRef = useRef(onSelectProperty);
  const onMoveEndRef = useRef(onMoveEnd);
  useEffect(() => {
    onSelectPropertyRef.current = onSelectProperty;
    onMoveEndRef.current = onMoveEnd;
  });

  // Initialize the map once. Layers/sources are added on "load", not here —
  // MapLibre requires the style to be ready first. olaMaps.init() is async
  // (it dynamically loads the bundled MapLibre GL + Ola style internally),
  // unlike plain `new MapLibreMap(...)`.
  //
  // Strict Mode note: dev double-invokes this effect (mount -> cleanup ->
  // mount) synchronously, before the init() promise can resolve. Starting a
  // second, independent olaMaps.init() call against the same container in
  // that window was confirmed (by testing, not guessed) to abort BOTH
  // instances' in-flight style/tile requests, leaving the map permanently
  // blank. Fix: every effect invocation shares one init() call
  // (initPromiseRef) instead of starting its own, and a token
  // (initTokenRef) identifies which invocation is the survivor — the
  // throwaway one's callback sees a stale token and leaves the (shared,
  // single) map instance alone rather than tearing it down out from under
  // the invocation that's actually going to use it.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    const myToken = ++initTokenRef.current;
    const isCurrent = () => !cancelled && initTokenRef.current === myToken;

    if (!isWebGL2Supported()) {
      // Deferred and token-guarded, not a bare setHasError(true): a Strict
      // Mode throwaway invocation's WebGL probe failing (observed via
      // testing — a fresh <canvas> context request can transiently fail on
      // the very first of two rapid-fire probes) must not stick and mask a
      // later invocation that goes on to actually succeed. hasError is only
      // ever meant to reflect the CURRENT (surviving) invocation's outcome.
      queueMicrotask(() => {
        if (isCurrent()) setHasError(true);
      });
      return;
    }

    if (!initPromiseRef.current) {
      initPromiseRef.current = getOlaMapsClient().init({
        container: containerRef.current,
        style: OLA_STYLE_URL,
        center: [center.lng, center.lat],
        zoom,
        ...OLA_MAP_VIEW_DEFAULTS,
        attributionControl: { compact: true },
      }) as Promise<MapLibreMap>;
    }

    initPromiseRef.current
      .then((map) => {
        if (!isCurrent()) return;
        const olaMaps = getOlaMapsClient();

        map.addControl(olaMaps.addNavigationControls({ showCompass: false }) as NavigationControl, "top-right");
        mapRef.current = map;

        // Deliberately NOT wired to hasError: MapLibre fires "error" for
        // routine, non-fatal request failures (a sprite icon 404, a tile
        // request aborted mid-pan, a flaky network blip) constantly, even
        // while the style goes on to load and render successfully — this
        // is normal for any tile-based map, not a sign the map is broken.
        // Confirmed via browser testing: wiring this to hasError, even
        // gated on "before style loaded", made the map permanently show
        // "unavailable" over an early transient error despite the style
        // finishing its load moments later. WebGL2 support (checked above,
        // before ever constructing a map) and the init() promise rejecting
        // (below) are the only conditions treated as actually fatal.

        map.on("load", () => {
          try {
            setUpMapLayers(map);
          } catch {
            setHasError(true);
          }
        });
        // A style already finished loading by the time init() resolved never
        // fires another "load" event — the effect above would then wait
        // forever. isStyleLoaded() covers exactly that race.
        if (map.isStyleLoaded()) {
          try {
            setUpMapLayers(map);
          } catch {
            setHasError(true);
          }
        }

        map.on("moveend", () => {
          if (!onMoveEndRef.current) return;
          const c = map.getCenter();
          onMoveEndRef.current({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() });
        });
      })
      .catch(() => {
        if (isCurrent()) setHasError(true);
      });

    function setUpMapLayers(map: MapLibreMap) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toGeoJSON([]),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 45,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0e8f5e",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 24],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#0f172a",
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (event: { features?: MapGeoJSONFeature[] }) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        source
          .getClusterExpansionZoom(feature.properties!.cluster_id)
          .then((expansionZoom: number) => {
            map.easeTo({
              center: feature.geometry.type === "Point" ? (feature.geometry.coordinates as [number, number]) : undefined,
              zoom: expansionZoom,
            });
          });
      });

      map.on("click", "unclustered", (event: { features?: MapGeoJSONFeature[] }) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const { slug, name, area, city, rent } = feature.properties as {
          slug: string;
          name: string;
          area: string;
          city: string;
          rent: number | null;
        };

        onSelectPropertyRef.current(slug);

        popupRef.current?.remove();
        popupRef.current = getOlaMapsClient().addPopup({ closeButton: true, offset: 12 }) as Popup;
        popupRef.current
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(buildPopupNode(name, area, city, rent, slug))
          .addTo(map);
      });

      map.on("mouseenter", "unclustered", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      setIsLoaded(true);
    }

    return () => {
      cancelled = true;
      // Only a genuine final teardown (setup had actually finished and
      // mapRef.current holds the shared instance) removes anything — a
      // Strict Mode throwaway cleanup runs before init() resolves, when
      // mapRef.current is still null, and must leave the in-flight
      // initPromiseRef alone so the very next (surviving) invocation
      // attaches to the same call instead of starting a second one.
      if (mapRef.current) {
        popupRef.current?.remove();
        userMarkerRef.current?.remove();
        mapRef.current.remove();
        mapRef.current = null;
        initPromiseRef.current = null;
      }
    };
    // Initialize once; center/zoom/properties changes are handled by the
    // effects below via imperative map calls, not by re-running this setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker source in sync with the shared filtered property list —
  // the same array the property list renders, so map and list can never
  // show a different set of properties.
  useEffect(() => {
    if (!isLoaded) return;
    const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toGeoJSON(properties));
  }, [properties, isLoaded]);

  // Programmatic moves only ever come from city/area selection (center/zoom
  // props), never from the map's own drag/zoom — see onMoveEnd above.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom, essential: true });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!selectedSlug) return;
    const property = properties.find((item) => item.slug === selectedSlug);
    if (property?.coordinates) {
      mapRef.current?.easeTo({ center: [property.coordinates.lng, property.coordinates.lat] });
    }
  }, [selectedSlug, properties]);

  // A card click, specifically -- not hover/focus, which only pans (above).
  // `token` in the dependency array (rather than just `popupRequest?.slug`)
  // is what lets clicking the same already-selected card twice in a row
  // reopen the popup after someone has closed it, since the slug alone
  // wouldn't change.
  useEffect(() => {
    if (!popupRequest || !isLoaded || !mapRef.current) return;
    const property = properties.find((item) => item.slug === popupRequest.slug);
    if (!property?.coordinates) return;

    popupRef.current?.remove();
    popupRef.current = getOlaMapsClient().addPopup({ closeButton: true, offset: 12 }) as Popup;
    popupRef.current
      .setLngLat([property.coordinates.lng, property.coordinates.lat])
      .setDOMContent(buildPopupNode(property.name, property.area, property.city, property.askingRent, property.slug))
      .addTo(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupRequest?.slug, popupRequest?.token, isLoaded, properties]);

  // The "you are here" marker — a plain MapLibre Marker (not a source/layer
  // like the property pins) since there is ever only one of these, deliberately
  // rendered in a color no property marker uses so it can never be mistaken
  // for a listing. Re-runs whenever userLocation changes, including to null
  // (HomeDiscovery clears it once the viewer navigates away from it), which
  // removes the marker rather than leaving a stale one behind.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;

    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Your current location");
    el.className = "relative flex h-4 w-4 items-center justify-center";
    el.innerHTML = `
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60"></span>
      <span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-[0_1px_4px_rgba(15,23,42,0.45)]"></span>
    `;

    userMarkerRef.current = getOlaMapsClient().addMarker({ element: el }) as Marker;
    userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]).addTo(mapRef.current);
  }, [userLocation, isLoaded]);

  const hasVisibleMarkers = properties.some((property) => property.coordinates !== null);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border border-border-subtle bg-surface-raised px-6 text-center">
        <p className="text-sm font-medium text-muted">Map unavailable in this browser</p>
        <p className="text-xs text-muted">
          This browser doesn&apos;t support the graphics required to show the map. The
          property list below still works normally.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
      <div ref={containerRef} className="h-full w-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
          <p className="text-sm font-medium text-muted">Loading map…</p>
        </div>
      )}
      {isLoaded && !hasVisibleMarkers && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-surface/95 px-4 py-3 text-center text-sm font-medium text-muted shadow-sm">
          No properties to show on the map yet.
        </div>
      )}
    </div>
  );
}
