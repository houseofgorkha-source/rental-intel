"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type StyleSpecification,
  type MapGeoJSONFeature,
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
  // Fires once the user finishes moving the map (drag/zoom end) — reports
  // the resulting view without feeding it back into `center`/`zoom`, so
  // dragging never triggers a city/area change on its own. This is exactly
  // the hook a future "Search this area" button would read from.
  onMoveEnd?: (view: { center: Coordinates; zoom: number }) => void;
};

// OpenStreetMap's standard raster tiles — no Mapbox/Google, no API key.
const OSM_STYLE: StyleSpecification = {
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

const SOURCE_ID = "properties";

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
          rent: property.askingRent,
        },
      })),
  };
}

export default function PropertyMap({
  properties,
  center,
  zoom,
  selectedSlug,
  onSelectProperty,
  onMoveEnd,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
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
  // MapLibre requires the style to be ready first.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
      });
    } catch {
      queueMicrotask(() => setHasError(true));
      return;
    }
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // Some failures (e.g. WebGL context creation failing after construction
    // succeeds) surface as an "error" event instead of a thrown exception.
    map.on("error", () => setHasError(true));

    map.on("load", () => {
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
          "circle-color": "#2563eb",
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
        const { slug, name, rent } = feature.properties as {
          slug: string;
          name: string;
          rent: number | null;
        };

        onSelectPropertyRef.current(slug);

        popupRef.current?.remove();
        const node = document.createElement("div");
        node.className = "text-sm";
        const title = document.createElement("p");
        title.className = "font-medium text-slate-950";
        title.textContent = name;
        const rentLine = document.createElement("p");
        rentLine.className = "mt-0.5 text-slate-600";
        rentLine.textContent = rent === null ? "Rent on request" : formatINRPerMonth(rent);
        const link = document.createElement("a");
        link.href = `/property/${slug}`;
        link.textContent = "View property →";
        link.className = "mt-1.5 inline-block font-medium text-blue-600 hover:underline";
        node.append(title, rentLine, link);

        popupRef.current = new Popup({ closeButton: true, offset: 12 })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(node)
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
    });

    map.on("moveend", () => {
      if (!onMoveEndRef.current) return;
      const c = map.getCenter();
      onMoveEndRef.current({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() });
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
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

  const hasVisibleMarkers = properties.some((property) => property.coordinates !== null);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 px-6 text-center">
        <p className="text-sm font-medium text-slate-700">Map unavailable in this browser</p>
        <p className="text-xs text-slate-500">
          This browser doesn&apos;t support the graphics required to show the map. The
          property list below still works normally.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-full w-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-sm font-medium text-slate-500">Loading map…</p>
        </div>
      )}
      {isLoaded && !hasVisibleMarkers && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm">
          No properties to show on the map yet.
        </div>
      )}
    </div>
  );
}
