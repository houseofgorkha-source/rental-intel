"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import PropertyMap from "@/components/property/PropertyMap";
import HomeSearch from "@/components/property/HomeSearch";
import UseMyLocationButton from "@/components/shared/UseMyLocationButton";
import {
  PropertyList,
  FiltersButton,
  DEFAULT_FILTERS,
  filterProperties,
  type PropertyFilters,
} from "@/components/property/PropertyDiscovery";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import {
  findNearestArea,
  findNearestCity,
  getAreaCoordinates,
  getCityCoordinates,
  type Coordinates,
} from "@/lib/area-coordinates";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type HomeDiscoveryProps = {
  properties: DiscoveryProperty[];
  // Static sections rendered below the hero grid, inside the same container
  // so they inherit its width and padding exactly. Passed as children so
  // they can stay server components rather than joining this client bundle.
  children?: React.ReactNode;
};

const CITY_ZOOM = 11;
const AREA_ZOOM = 14;
// Closer than AREA_ZOOM: this is the user's own reported position, not an
// approximate area centroid, so the map can afford to sit nearer to it.
const MY_LOCATION_ZOOM = 15;

// Single source of truth for the homepage's search/filter/map state. The
// unified Search (city + multi-area + text), the Filters panel, and the map
// are siblings with no ancestor of their own — this is their nearest common
// ancestor, so it owns city/areas/query/filters/map view/selected property
// once, and every view reads and writes through the same state rather than
// keeping its own copy. `filterProperties` (from PropertyDiscovery.tsx) is
// called exactly once, here, and the resulting array is handed to both the
// map and the list — they can't disagree about what's visible because
// they're literally looking at the same array reference.
export default function HomeDiscovery({ properties, children }: HomeDiscoveryProps) {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // A fresh object per click (not just the slug) so clicking the same
  // already-selected card twice in a row still reopens the popup — see
  // PropertyMap's own comment on why token, not slug alone, is watched.
  const [popupRequest, setPopupRequest] = useState<{ slug: string; token: number } | null>(null);
  // The browser's real reported coordinates, set only by "Use my current
  // location" — never an area/city centroid. Cleared whenever the user
  // manually changes city/area afterward, so the "you are here" marker can't
  // sit somewhere no longer related to what's on screen.
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [mapView, setMapView] = useState<{ center: Coordinates; zoom: number }>({
    center: getCityCoordinates(DEFAULT_CITY),
    zoom: CITY_ZOOM,
  });

  // Below `lg` the map sits stacked above the list, so a card tap that opens
  // a popup up there can land off-screen if the list has been scrolled into
  // view — this ref lets that tap bring the map (and its new popup) back
  // into view instead of silently doing nothing the viewer can see.
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Reported after the user finishes dragging/zooming the map, kept separate
  // from `mapView` (which only ever changes via city/area selection) so a
  // drag never feeds back into a city/area change. Not read anywhere yet —
  // this is exactly the state a future "Search this area" button would read
  // from to run a query against the map's current bounds.
  const lastUserMapView = useRef<{ center: Coordinates; zoom: number } | null>(null);

  const cityProperties = useMemo(
    () => properties.filter((property) => cityMatches(property.city, selectedCity)),
    [properties, selectedCity],
  );

  const visibleProperties = useMemo(
    () =>
      filterProperties(cityProperties, {
        areas: selectedAreas,
        query: searchQuery,
        filters,
      }),
    [cityProperties, selectedAreas, filters, searchQuery],
  );

  const searchProperties = cityProperties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: `${property.area}, ${property.city}`,
  }));

  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    // Clear any area selections that don't belong to the new city.
    setSelectedAreas([]);
    setSelectedSlug(null);
    // A manual city change moves away from wherever "Use my current location"
    // last pointed at, so that marker should no longer show.
    setUserLocation(null);
    setMapView({ center: getCityCoordinates(city), zoom: CITY_ZOOM });
  }, []);

  const handleAreasChange = useCallback(
    (areas: string[]) => {
      setSelectedAreas(areas);
      setSelectedSlug(null);
      setUserLocation(null);
      // Fly to the most recently added area, or back to the city view once
      // the last one is removed.
      const lastArea = areas[areas.length - 1];
      const areaCoordinates = lastArea ? getAreaCoordinates(lastArea) : null;
      setMapView(
        areaCoordinates
          ? { center: areaCoordinates, zoom: AREA_ZOOM }
          : { center: getCityCoordinates(selectedCity), zoom: CITY_ZOOM },
      );
    },
    [selectedCity],
  );

  const handleMoveEnd = useCallback((view: { center: Coordinates; zoom: number }) => {
    lastUserMapView.current = view;
  }, []);

  // Same "open the popup" request PropertyMap already understood, plus a
  // scroll below `lg` — matches the breakpoint where the grid stops sitting
  // side-by-side (see the grid className below) and stacks the map above
  // the list instead, which is exactly when a tap needs this nudge.
  const handleActivateProperty = useCallback((slug: string) => {
    setPopupRequest({ slug, token: Date.now() });
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      mapContainerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  // The map centers on the browser's actual coordinates — never an area or
  // city centroid — and a "you are here" marker renders at that exact point
  // (see PropertyMap). City/area selection still updates from the same
  // coordinates, purely so the property list/filters reflect where the user
  // actually is; that lookup is deliberately NOT routed through
  // handleCityChange/handleAreasChange, since both of those re-center the
  // map on a centroid, which would immediately overwrite the real position
  // this handler just set.
  const handleLocated = useCallback((coordinates: Coordinates) => {
    setUserLocation(coordinates);
    setSelectedSlug(null);
    setMapView({ center: coordinates, zoom: MY_LOCATION_ZOOM });

    const nearestCity = findNearestCity(coordinates);
    if (!nearestCity) return;
    setSelectedCity(nearestCity);
    const nearestArea = findNearestArea(coordinates, nearestCity);
    setSelectedAreas(nearestArea ? [nearestArea] : []);
  }, []);

  // The search icon's own action: go to the canonical search results page
  // (§21) for whatever is currently selected — city, area(s), and any typed
  // text — rather than guessing a single property to jump to. Enter and a
  // clicked dropdown suggestion are untouched; this only changes the icon.
  const handleSearchIconClick = useCallback(() => {
    const params = new URLSearchParams();
    params.set("city", selectedCity);
    if (selectedAreas.length > 0) params.set("areas", selectedAreas.join(","));
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    router.push(`/property?${params.toString()}`);
  }, [router, selectedCity, selectedAreas, searchQuery]);

  return (
    <main className="min-w-0 bg-background">
      <div className="mx-auto max-w-[1600px] px-7 pb-16 pt-28 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch lg:gap-8">
          {/* Left: hero copy + community copy form one continuous column,
              no search controls here anymore. */}
          <section className="flex min-w-0 flex-col justify-center py-4 lg:py-10">
            <div className="max-w-md">
              <h1 className="text-[clamp(2.4rem,4.2vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.05em] text-foreground">
                Know it before you <span className="text-accent">rent.</span>
              </h1>
              <p className="mt-6 text-sm leading-6 text-muted sm:text-base sm:leading-7">
                Search properties with genuine tenant experiences before you rent.
              </p>
            </div>

            <div className="mt-12 max-w-md sm:mt-16">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                Be part of the community.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base sm:leading-7">
                Share your experience about the place you call home today. Help
                future renters make better decisions while building a more
                transparent rental community.
              </p>
              <Link
                href="/review"
                className="mt-4 inline-flex text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
              >
                Review Your Current Rental Property
              </Link>
            </div>
          </section>

          {/* Right: the unified discovery panel — one shared surface holding
              the toolbar, the map, and the property list. */}
          <section className="min-w-0" aria-label="Property discovery">
            <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(14,143,94,0.04)]">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-6">
                <UseMyLocationButton onLocated={handleLocated} compact />

                <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-end sm:gap-3">
                  <HomeSearch
                    properties={searchProperties}
                    city={selectedCity}
                    onCityChange={handleCityChange}
                    areas={LOCALITIES_BY_CITY[selectedCity] ?? []}
                    selectedAreas={selectedAreas}
                    onAreasChange={handleAreasChange}
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    onSearchIconClick={handleSearchIconClick}
                  />
                  {/* On mobile this same control renders instead beside the
                      "{city} properties" heading (via PropertyList's
                      headerAction below), where it stays visible on the
                      sticky bar while cards scroll — hidden here so it
                      isn't shown twice. */}
                  <div className="hidden sm:block">
                    <FiltersButton filters={filters} onFiltersChange={setFilters} />
                  </div>
                </div>
              </div>

              {cityProperties.length === 0 && (
                <p className="px-4 pb-2 text-sm text-muted sm:px-6">
                  {selectedCity === DEFAULT_CITY
                    ? "No properties are available yet. Try adding the first one."
                    : `${selectedCity} is coming soon. Try ${DEFAULT_CITY} for now.`}
                </p>
              )}

              {/* Map and list touch — one divider (horizontal on mobile
                  where they stack, vertical at lg where they sit side by
                  side), no gap, same height. */}
              <div className="grid divide-y divide-border-subtle lg:h-[30rem] lg:grid-cols-[3fr_2fr] lg:divide-x lg:divide-y-0">
                <div ref={mapContainerRef} className="h-[22rem] lg:h-full">
                  <PropertyMap
                    properties={visibleProperties}
                    center={mapView.center}
                    zoom={mapView.zoom}
                    selectedSlug={selectedSlug}
                    onSelectProperty={setSelectedSlug}
                    popupRequest={popupRequest}
                    userLocation={userLocation}
                    onMoveEnd={handleMoveEnd}
                  />
                </div>

                {/* No scrolling here anymore — PropertyList (compact mode)
                    owns that itself, scoped to just its card grid, with the
                    heading living outside the scroll region entirely. This
                    div still needs `lg:overflow-hidden`, though, for a real
                    CSS Grid reason: a grid item without its own `overflow`
                    keeps its "automatic minimum size" content-based, so the
                    implicit row track just grows to fit everything instead
                    of respecting the grid's explicit `lg:h-[30rem]` — which
                    is exactly what silently broke `lg:h-full` below. Setting
                    `overflow` (even hidden, since nothing needs to visibly
                    escape this box) is what makes the row size stick. */}
                {/* Small horizontal padding on mobile (not the old 16px) —
                    the map directly above has none at all, so matching
                    padding here made the heading/cards look narrower than
                    the map right above them and wasted width. Kept at 8px
                    rather than 0 so corner cards don't visually clip against
                    this panel's own rounded-2xl corner. Vertical padding
                    (py-4) stays for breathing room. Unchanged at `sm`+
                    (still p-6, matches the toolbar above it). */}
                <div className="px-2 py-4 sm:p-6 lg:h-full lg:overflow-hidden">
                  <PropertyList
                    properties={visibleProperties}
                    heading={`${selectedCity} properties`}
                    compact
                    selectedSlug={selectedSlug}
                    onSelectProperty={setSelectedSlug}
                    onActivateProperty={handleActivateProperty}
                    headerAction={
                      <div className="sm:hidden">
                        <FiltersButton filters={filters} onFiltersChange={setFilters} />
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {children}
      </div>
    </main>
  );
}
