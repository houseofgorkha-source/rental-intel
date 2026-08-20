"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getOlaMapsClient, OLA_STYLE_URL, OLA_MAP_VIEW_DEFAULTS } from "@/components/property/PropertyMap";
import ZoomPanImage from "@/components/shared/ZoomPanImage";
import { CLUSTER_LABELS, groupByCluster, type PreviewBoard, type PreviewDataset, type PreviewMapConfig } from "@/lib/spotted-boards-preview";

type Props = {
  dataset: PreviewDataset;
};

function formatSpottedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function SpottedBoardsPreviewSection({ dataset }: Props) {
  const byCluster = useMemo(() => groupByCluster(dataset.boards), [dataset.boards]);
  const clusterOptions = useMemo(
    () => ["all", ...Object.keys(byCluster).sort((a, b) => byCluster[b].length - byCluster[a].length)],
    [byCluster]
  );
  const bhkOptions = useMemo(
    () => [...new Set(dataset.boards.map((b) => b.bhk).filter((v): v is string => Boolean(v)))].sort(),
    [dataset.boards]
  );

  const [cluster, setCluster] = useState("all");
  const [bhkFilter, setBhkFilter] = useState<string | null>(null);
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lightboxBoard, setLightboxBoard] = useState<PreviewBoard | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filteredBoards = useMemo(() => {
    return dataset.boards.filter((b) => {
      if (cluster !== "all" && b.cluster !== cluster) return false;
      if (bhkFilter && b.bhk !== bhkFilter) return false;
      if (phoneOnly && !b.phone) return false;
      return true;
    });
  }, [dataset.boards, cluster, bhkFilter, phoneOnly]);

  const mapKey = cluster === "all" ? "all" : cluster;
  const mapConfig = dataset.maps[mapKey] ?? dataset.maps.all;
  // Pins on the map always reflect the map's own cluster scope (not the
  // bhk/phone filters) — filtering to "2 BHK only" narrows the card list,
  // it shouldn't make pins vanish with no visual explanation. Only the
  // cluster selector changes which pins are shown.
  const pinsForMap = mapKey === "all" ? dataset.boards : (byCluster[mapKey] ?? []);

  function selectBoard(id: string) {
    setSelectedId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section aria-labelledby="spotted-boards-preview-heading" className="mt-16 lg:mt-24">
      <h2 id="spotted-boards-preview-heading" className="text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
        To-Let Board <span className="text-accent">Detection.</span>
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
        Found automatically by scanning Ola Maps Street View imagery for real &ldquo;TO-LET&rdquo; signage —
        a technical preview of the tolet-vision pipeline, not the crowdsourced board map above.
        Nothing here is verified, and this data isn&apos;t stored in RentalIntel&apos;s database.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(14,143,94,0.04)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-4 sm:p-6">
          <select
            value={cluster}
            onChange={(e) => {
              setCluster(e.target.value);
              setSelectedId(null);
            }}
            className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          >
            {clusterOptions.map((c) => (
              <option key={c} value={c}>
                {CLUSTER_LABELS[c] ?? c} ({c === "all" ? dataset.boards.length : byCluster[c]?.length ?? 0})
              </option>
            ))}
          </select>

          <select
            value={bhkFilter ?? ""}
            onChange={(e) => setBhkFilter(e.target.value || null)}
            className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          >
            <option value="">Any BHK</option>
            {bhkOptions.map((v) => (
              <option key={v} value={v}>
                {v} BHK
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-4 py-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={phoneOnly}
              onChange={(e) => setPhoneOnly(e.target.checked)}
              className="accent-accent"
            />
            Has phone number
          </label>

          <span className="ml-auto text-sm text-muted">
            {filteredBoards.length} of {dataset.boards.length} boards
          </span>
        </div>

        <div className="grid divide-y divide-border-subtle lg:h-[36rem] lg:grid-cols-[3fr_2fr] lg:divide-x lg:divide-y-0">
          <div className="relative h-[24rem] bg-surface-raised lg:h-full">
            {mapConfig ? (
              <SpottedBoardsPreviewMap
                mapConfig={mapConfig}
                pins={pinsForMap}
                filteredBoards={filteredBoards}
                selectedId={selectedId}
                onSelectBoard={selectBoard}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">Map unavailable</div>
            )}
          </div>

          <div className="overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            {filteredBoards.length === 0 ? (
              <p className="col-span-full text-sm text-muted">No boards match these filters.</p>
            ) : (
              filteredBoards.map((board) => (
                <div
                  key={board.id}
                  ref={(el) => {
                    cardRefs.current[board.id] = el;
                  }}
                  className={`overflow-hidden rounded-xl border bg-surface transition ${
                    selectedId === board.id ? "border-accent ring-2 ring-accent/25" : "border-border-subtle"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxBoard(board)}
                    className="block w-full cursor-zoom-in"
                    aria-label="View full-size photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={board.imagePath} alt="To-Let board, cropped from street-view imagery" className="h-44 w-full object-cover" />
                  </button>
                  <div className="flex flex-col gap-1.5 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {board.provider === "google" && (
                        <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">Google Tiles</span>
                      )}
                      {board.provider === "google" && board.hasDetection === false && (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted">no board detected</span>
                      )}
                      {board.bhk && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{board.bhk} BHK</span>
                      )}
                      {board.observationCount > 1 && (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted">
                          seen {board.observationCount}×
                        </span>
                      )}
                    </div>

                    {board.phone ? (
                      <a href={`tel:${board.phone}`} className="text-sm font-semibold text-accent hover:text-accent-hover">
                        {board.phone}
                      </a>
                    ) : (
                      <span className="text-sm italic text-muted">No phone extracted</span>
                    )}

                    {board.propertyName && <p className="truncate text-xs text-foreground">{board.propertyName}</p>}

                    <p className="truncate text-xs text-muted">{board.locality}</p>
                    {board.provider === "google" && board.olaPhone && (
                      <p className="text-[0.7rem] text-muted">Ola found at this spot: {board.olaPhone}</p>
                    )}
                    <p className="text-[0.7rem] text-muted">Spotted {formatSpottedDate(board.firstSeenAt)}</p>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>

      {lightboxBoard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxBoard(null)}
        >
          <div className="max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="h-[min(75vh,32rem)] w-full bg-black">
              <ZoomPanImage src={lightboxBoard.imagePath} alt="To-Let board, full size" className="h-full w-full" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                {lightboxBoard.bhk && (
                  <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{lightboxBoard.bhk} BHK</span>
                )}
                {lightboxBoard.phone ? (
                  <a href={`tel:${lightboxBoard.phone}`} className="text-sm font-semibold text-accent hover:text-accent-hover">
                    {lightboxBoard.phone}
                  </a>
                ) : (
                  <span className="text-sm italic text-muted">No phone extracted</span>
                )}
                <p className="mt-0.5 text-xs text-muted">{lightboxBoard.locality}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxBoard(null)}
                className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Live Ola Maps view of this preview's boards — replaces the earlier
// approach (a pre-exported static screenshot with pins CSS-positioned via
// lib/map-projection.ts's fixed-center/fixed-zoom pixel math). Reuses the
// exact same Ola Maps foundation as the homepage/property map
// (getOlaMapsClient/OLA_STYLE_URL/OLA_MAP_VIEW_DEFAULTS from
// components/property/PropertyMap.tsx — see that file's own comment on why
// this is centralized), so the two never drift onto different styles.
function SpottedBoardsPreviewMap({
  mapConfig,
  pins,
  filteredBoards,
  selectedId,
  onSelectBoard,
}: {
  mapConfig: PreviewMapConfig;
  pins: PreviewBoard[];
  filteredBoards: PreviewBoard[];
  selectedId: string | null;
  onSelectBoard: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupRef = useRef<Popup | null>(null);
  // Shared across a Strict Mode dev double-invoke of the init effect below —
  // see PropertyMap.tsx's identical fields for the full explanation (a
  // second, independent olaMaps.init() call on the same container was
  // confirmed by testing to abort both instances' requests and leave the
  // map permanently blank in dev).
  const initPromiseRef = useRef<Promise<MapLibreMap> | null>(null);
  const initTokenRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);
  // A bad/domain-restricted key, or any other style-load failure, surfaces
  // as an "error" event rather than a rejected init() promise (MapLibre
  // keeps the map instance alive and just fails to apply the style) — must
  // be handled explicitly, or the "Loading map…" state below would spin
  // forever instead of degrading like PropertyMap's own hasError does.
  const [hasError, setHasError] = useState(false);

  // Mount once. Individual Markers (like SpottedBoardsSection.tsx's own
  // map), not PropertyMap's clustered GeoJSON source — this dataset is a
  // small, fixed preview export, not a live discovery panel.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    const myToken = ++initTokenRef.current;
    const isCurrent = () => !cancelled && initTokenRef.current === myToken;

    if (!initPromiseRef.current) {
      initPromiseRef.current = getOlaMapsClient().init({
        container: containerRef.current,
        style: OLA_STYLE_URL,
        center: [mapConfig.centerLon, mapConfig.centerLat],
        zoom: mapConfig.zoom,
        ...OLA_MAP_VIEW_DEFAULTS,
        attributionControl: { compact: true },
      }) as Promise<MapLibreMap>;
    }

    initPromiseRef.current
      .then((map) => {
        if (!isCurrent()) return;
        const olaMaps = getOlaMapsClient();
        // Deliberately not wired to hasError — see PropertyMap.tsx's
        // identical comment: MapLibre fires routine, non-fatal "error"
        // events (a sprite 404, an aborted tile request) even while the
        // style goes on to load successfully; only WebGL2 absence and the
        // init() promise rejecting (below) are treated as actually fatal.
        map.addControl(olaMaps.addNavigationControls({ showCompass: false }), "top-right");
        mapRef.current = map;
        map.on("load", () => setIsLoaded(true));
        if (map.isStyleLoaded()) setIsLoaded(true);
      })
      .catch(() => {
        if (isCurrent()) setHasError(true);
      });

    return () => {
      cancelled = true;
      // Only a genuine final teardown (mapRef.current populated) removes
      // anything — see PropertyMap.tsx's identical cleanup for why a Strict
      // Mode throwaway invocation must leave the in-flight initPromiseRef
      // alone instead of nulling it out from under the surviving invocation.
      if (mapRef.current) {
        popupRef.current?.remove();
        Object.values(markersRef.current).forEach((marker) => marker.remove());
        mapRef.current.remove();
        mapRef.current = null;
        initPromiseRef.current = null;
      }
    };
    // Mount once; the effects below reposition/redraw imperatively instead
    // of re-running this setup on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the cluster filter changes which map/scope is active.
  useEffect(() => {
    mapRef.current?.easeTo({ center: [mapConfig.centerLon, mapConfig.centerLat], zoom: mapConfig.zoom });
  }, [mapConfig.centerLat, mapConfig.centerLon, mapConfig.zoom]);

  // Redraw markers whenever the pin set or the BHK/phone filter's dimming
  // changes — dimming state (not just presence) affects marker color, so
  // this must re-run on filteredBoards too, not just pins.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const olaMaps = getOlaMapsClient();
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    for (const board of pins) {
      const dimmed = !filteredBoards.some((b) => b.id === board.id);
      const selected = selectedId === board.id;
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `Jump to board ${board.phone ?? board.id}`);
      el.className = [
        "block h-6 w-6 cursor-pointer rounded-full border-2 transition",
        selected
          ? "scale-125 border-white bg-accent shadow-lg"
          : dimmed
            ? "border-white/60 bg-muted/50"
            : board.provider === "google"
              ? "border-white bg-blue-500 hover:scale-110"
              : "border-white bg-danger hover:scale-110",
      ].join(" ");
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectBoard(board.id);

        popupRef.current?.remove();
        const node = document.createElement("div");
        node.innerHTML = `
          <img src="${board.imagePath}" alt="" style="width:128px;height:80px;object-fit:cover;border-radius:8px;" />
          <p style="margin-top:6px;font-size:12px;font-weight:500;">${board.phone ?? "No phone extracted"}</p>
        `;
        const popup = olaMaps.addPopup({ closeButton: true, offset: 12 }) as Popup;
        popup.setLngLat([board.longitude, board.latitude]).setDOMContent(node).addTo(mapRef.current!);
        popupRef.current = popup;
      });

      const marker = olaMaps.addMarker({ element: el });
      marker.setLngLat([board.longitude, board.latitude]).addTo(mapRef.current);
      markersRef.current[board.id] = marker;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, filteredBoards, selectedId, isLoaded]);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-raised px-6 text-center">
        <p className="text-sm font-medium text-muted">Map unavailable</p>
        <p className="text-xs text-muted">The board cards on the right still work normally.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
          <p className="text-sm font-medium text-muted">Loading map…</p>
        </div>
      )}
    </div>
  );
}
