"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "@/components/property/PropertyMap";
import CitySelector from "@/components/CitySelector";
import AreaMultiSelect from "@/components/property/AreaMultiSelect";
import UseMyLocationButton from "@/components/shared/UseMyLocationButton";
import { submitSpottedBoard } from "@/app/actions/spotted-boards";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import {
  getAreaCoordinates,
  getCityCoordinates,
  findNearestCity,
  findNearestArea,
  type Coordinates,
} from "@/lib/area-coordinates";
import type { SpottedBoard } from "@/lib/spotted-boards";

const CITY_ZOOM = 11;
const PICKER_ZOOM = 15;

type SpottedBoardsSectionProps = {
  boards: SpottedBoard[];
};

// Replicates findghosla.com/tolet's crowdsourced "TO LET" signboard map —
// its own thing, deliberately separate from the property discovery panel
// above: no review/verification machinery, no detail page, just a photo, a
// pin, and a phone number, explicitly disclaimed as unverified (see the
// migration's own comment for why submission needs no account here, unlike
// everywhere else in the app).
export default function SpottedBoardsSection({ boards }: SpottedBoardsSectionProps) {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popupRequest, setPopupRequest] = useState<{ id: string; token: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const filteredBoards = useMemo(
    () =>
      boards.filter(
        (board) =>
          cityMatches(board.city, selectedCity) &&
          (selectedAreas.length === 0 || (board.area && selectedAreas.includes(board.area))),
      ),
    [boards, selectedCity, selectedAreas],
  );

  useEffect(() => {
    if (!selectedId) return;
    cardRefs.current[selectedId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  function handleCityChange(city: string) {
    setSelectedCity(city);
    setSelectedAreas([]);
    setSelectedId(null);
  }

  return (
    <section aria-labelledby="spotted-boards-heading" className="mt-16 lg:mt-24">
      <h2 id="spotted-boards-heading" className="text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
        To-Let <span className="text-accent">Boards.</span>
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
        Spotted on the street by other renters — a photo, a pin, and a number, nothing more.
        We haven&apos;t verified any of this: a number might be old, wrong, or picked up by a
        broker. Worth trying as a last resort, not a first stop.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(14,143,94,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <CitySelector value={selectedCity} onChange={handleCityChange} variant="pill" />
            <AreaMultiSelect
              areas={LOCALITIES_BY_CITY[selectedCity] ?? []}
              value={selectedAreas}
              onChange={setSelectedAreas}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            + Add a spotted board
          </button>
        </div>

        {filteredBoards.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted sm:px-6">
            No spotted boards here yet. Be the first to add one.
          </p>
        ) : (
          <div className="grid divide-y divide-border-subtle lg:h-[26rem] lg:grid-cols-[3fr_2fr] lg:divide-x lg:divide-y-0">
            <div className="h-[22rem] lg:h-full">
              <SpottedBoardsMap
                boards={filteredBoards}
                center={getAreaCoordinates(selectedAreas[0] ?? "") ?? getCityCoordinates(selectedCity)}
                zoom={selectedAreas.length > 0 ? PICKER_ZOOM : CITY_ZOOM}
                selectedId={selectedId}
                onSelectBoard={setSelectedId}
                popupRequest={popupRequest}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 sm:p-6 lg:h-full">
              {filteredBoards.map((board) => (
                <button
                  key={board.id}
                  ref={(element) => {
                    cardRefs.current[board.id] = element;
                  }}
                  type="button"
                  onClick={() => {
                    setSelectedId(board.id);
                    setPopupRequest({ id: board.id, token: Date.now() });
                  }}
                  className={`overflow-hidden rounded-xl border bg-surface text-left transition hover:-translate-y-1 hover:border-accent/60 ${
                    selectedId === board.id ? "border-accent ring-2 ring-accent/25" : "border-border-subtle"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={board.imageUrl} alt="Spotted to-let board" className="aspect-square w-full object-cover" />
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground">{board.area ?? board.city}</p>
                    <a
                      href={`tel:${board.phone.replace(/\s+/g, "")}`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-0.5 block truncate text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      {board.phone}
                    </a>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <AddSpottedBoardModal
          defaultCity={selectedCity}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </section>
  );
}

function SpottedBoardsMap({
  boards,
  center,
  zoom,
  selectedId,
  onSelectBoard,
  popupRequest,
}: {
  boards: SpottedBoard[];
  center: Coordinates;
  zoom: number;
  selectedId: string | null;
  onSelectBoard: (id: string) => void;
  popupRequest: { id: string; token: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupRef = useRef<Popup | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Mount once. Individual Markers rather than a clustered GeoJSON source
  // (PropertyMap.tsx's approach) — this dataset is expected to stay small,
  // so clustering machinery would be more code for no real benefit.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setIsLoaded(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the filter changes the area/city focus.
  useEffect(() => {
    mapRef.current?.easeTo({ center: [center.lng, center.lat], zoom });
  }, [center.lat, center.lng, zoom]);

  // Redraw markers whenever the filtered board list changes.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    for (const board of boards) {
      const marker = new Marker({ color: "#0e8f5e" })
        .setLngLat([board.longitude, board.latitude])
        .addTo(mapRef.current);
      marker.getElement().addEventListener("click", () => onSelectBoard(board.id));
      markersRef.current[board.id] = marker;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, isLoaded]);

  // A card click, specifically — opens the popup, same content either way.
  useEffect(() => {
    if (!popupRequest || !isLoaded || !mapRef.current) return;
    const board = boards.find((item) => item.id === popupRequest.id);
    if (!board) return;

    popupRef.current?.remove();
    const node = document.createElement("div");
    node.innerHTML = `
      <img src="${board.imageUrl}" alt="Spotted to-let board" style="width:160px;height:120px;object-fit:cover;border-radius:8px;" />
      <p style="margin-top:6px;font-size:13px;font-weight:500;">${board.area ?? board.city}</p>
      <a href="tel:${board.phone.replace(/\s+/g, "")}" style="font-size:13px;color:#0e8f5e;font-weight:500;">${board.phone}</a>
    `;
    popupRef.current = new Popup({ closeButton: true, offset: 12 })
      .setLngLat([board.longitude, board.latitude])
      .setDOMContent(node)
      .addTo(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupRequest?.id, popupRequest?.token, isLoaded]);

  useEffect(() => {
    if (!selectedId) return;
    const board = boards.find((item) => item.id === selectedId);
    if (board) mapRef.current?.easeTo({ center: [board.longitude, board.latitude] });
  }, [selectedId, boards]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function AddSpottedBoardModal({
  defaultCity,
  onClose,
}: {
  defaultCity: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // The pin is the source of truth for where the board actually is — city/
  // area are derived from it via the same nearest-neighbor lookup the
  // homepage's "Use My Location" flow already uses, not from whatever city
  // filter happened to be selected when the modal opened (defaultCity is
  // only the map's starting center).
  const resolvedLocation = useMemo(() => {
    if (!pin) return null;
    const city = findNearestCity(pin) ?? defaultCity;
    const area = findNearestArea(pin, city);
    return { city, area };
  }, [pin, defaultCity]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = getCityCoordinates(defaultCity);
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [start.lng, start.lat],
      zoom: CITY_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    function placeMarker(point: Coordinates) {
      markerRef.current?.remove();
      markerRef.current = new Marker({ draggable: true, color: "#0e8f5e" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const { lat, lng } = markerRef.current!.getLngLat();
        setPin({ lat, lng });
      });
    }

    map.on("click", (event) => {
      setPin({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      placeMarker({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [defaultCity]);

  function handleLocated(point: Coordinates) {
    setPin(point);
    markerRef.current?.remove();
    markerRef.current = new Marker({ draggable: true, color: "#0e8f5e" })
      .setLngLat([point.lng, point.lat])
      .addTo(mapRef.current!);
    markerRef.current.on("dragend", () => {
      const { lat, lng } = markerRef.current!.getLngLat();
      setPin({ lat, lng });
    });
    mapRef.current?.easeTo({ center: [point.lng, point.lat], zoom: PICKER_ZOOM });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin || !resolvedLocation) {
      setError("Please tap the map to drop a pin at the board's location.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.set("latitude", String(pin.lat));
    formData.set("longitude", String(pin.lng));
    formData.set("city", resolvedLocation.city);
    formData.set("area", resolvedLocation.area ?? "");

    const result = await submitSpottedBoard(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setIsDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Add a spotted board</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted transition hover:text-foreground">
            ×
          </button>
        </div>

        {isDone ? (
          <div className="mt-6">
            <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
              Thanks — it&apos;s live on the map now.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {/* Honeypot — see PropertyForm.tsx's own comment for the pattern. */}
            <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">Photo of the board</label>
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                required
                className="mt-2 block w-full text-sm text-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">Location</label>
              <p className="mt-1 text-sm text-muted">
                Tap the map, or use your current location, to mark exactly where the board is.
              </p>
              <div className="mt-2">
                <UseMyLocationButton onLocated={handleLocated} compact />
              </div>
              <div ref={containerRef} className="mt-2 h-56 w-full overflow-hidden rounded-xl border border-border-subtle" />
              {resolvedLocation && (
                <p className="mt-2 text-xs text-muted">
                  Pinned near{" "}
                  <span className="font-medium text-foreground">
                    {resolvedLocation.area ? `${resolvedLocation.area}, ` : ""}
                    {resolvedLocation.city}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">Phone number on the board</label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="+91 98765 43210"
                className="mt-2 w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted"
            >
              {isSubmitting ? "Submitting…" : "Add to the map"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
