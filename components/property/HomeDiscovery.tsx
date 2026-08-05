"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import PropertyMap from "@/components/property/PropertyMap";
import {
  PropertyList,
  RENT_MIN,
  RENT_MAX,
  filterProperties,
  type OnlyShowFilters,
} from "@/components/property/PropertyDiscovery";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import { getAreaCoordinates, getCityCoordinates, type Coordinates } from "@/lib/area-coordinates";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type HomeDiscoveryProps = {
  properties: DiscoveryProperty[];
};

const CITY_ZOOM = 11;
const AREA_ZOOM = 14;

// Single source of truth for the homepage's search/filter/map state. The
// hero's SearchBar, the property panel's toolbar, and the map are siblings
// with no ancestor of their own — this is their nearest common ancestor, so
// it owns city/area/query/filters/map view/selected property once, and every
// view reads and writes through the same state rather than keeping its own
// copy. `filterProperties` (from PropertyDiscovery.tsx) is called exactly
// once, here, and the resulting array is handed to both the map and the
// list — they can't disagree about what's visible because they're literally
// looking at the same array reference.
export default function HomeDiscovery({ properties }: HomeDiscoveryProps) {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rentRange, setRentRange] = useState<[number, number]>([RENT_MIN, RENT_MAX]);
  const [onlyShow, setOnlyShow] = useState<OnlyShowFilters>({
    reviewsOnly: false,
    photosOnly: false,
  });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mapView, setMapView] = useState<{ center: Coordinates; zoom: number }>({
    center: getCityCoordinates(DEFAULT_CITY),
    zoom: CITY_ZOOM,
  });

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
        area: selectedArea,
        rentRange,
        onlyShow,
        query: searchQuery,
      }),
    [cityProperties, selectedArea, rentRange, onlyShow, searchQuery],
  );

  const searchProperties = cityProperties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: `${property.area}, ${property.city}`,
  }));

  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    // Clear any area selection that doesn't belong to the new city.
    setSelectedArea(null);
    setSelectedSlug(null);
    setMapView({ center: getCityCoordinates(city), zoom: CITY_ZOOM });
  }, []);

  const handleAreaChange = useCallback(
    (area: string | null) => {
      setSelectedArea(area);
      setSelectedSlug(null);
      const areaCoordinates = area ? getAreaCoordinates(area) : null;
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

  return (
    <main className="min-h-screen min-w-0 bg-[#fbfbfa]">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2 lg:items-start">
        <section className="min-w-0 px-7 pb-16 pt-28 lg:px-12 xl:px-20">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.6rem,5vw,4.75rem)] font-medium leading-[0.98] tracking-[-0.055em] text-slate-950">
              Know it before you <span className="text-blue-600">rent.</span>
            </h1>

            <p className="mt-6 max-w-[31rem] text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Search properties with genuine tenant experiences before you rent.
            </p>

            <div className="mt-12 max-w-xl">
              <SearchBar
                properties={searchProperties}
                city={selectedCity}
                onCityChange={handleCityChange}
                query={searchQuery}
                onQueryChange={setSearchQuery}
              />
              {cityProperties.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  {selectedCity === DEFAULT_CITY
                    ? "No properties are available yet. Try adding the first one."
                    : `${selectedCity} is coming soon. Try ${DEFAULT_CITY} for now.`}
                </p>
              )}
            </div>

            <div className="mt-10 h-[22rem] max-w-xl sm:h-[26rem]">
              <PropertyMap
                properties={visibleProperties}
                center={mapView.center}
                zoom={mapView.zoom}
                selectedSlug={selectedSlug}
                onSelectProperty={setSelectedSlug}
                onMoveEnd={handleMoveEnd}
              />
            </div>

            <div className="mt-12 max-w-[31rem] border-t border-slate-200 pt-8">
              <p className="text-base font-semibold text-slate-900">
                Be part of the community.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Share your experience about the place you call home today. Help
                future renters make better decisions while building a more
                transparent rental community.
              </p>
              <Link
                href="/add-property"
                className="mt-4 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
              >
                Review Your Current Stay
              </Link>
            </div>
          </div>
        </section>

        <section className="min-w-0 px-7 pt-28 lg:px-12 xl:px-20" aria-label="Property discovery">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#f6f6f4] p-6 lg:p-8">
            <PropertyList
              properties={visibleProperties}
              heading={`${selectedCity} properties`}
              showToolbar
              compact
              scrollable
              areas={LOCALITIES_BY_CITY[selectedCity] ?? []}
              city={selectedCity}
              onCityChange={handleCityChange}
              selectedArea={selectedArea}
              onAreaChange={handleAreaChange}
              rentRange={rentRange}
              onRentRangeChange={setRentRange}
              onlyShow={onlyShow}
              onOnlyShowChange={setOnlyShow}
              searchQuery={searchQuery}
              selectedSlug={selectedSlug}
              onSelectProperty={setSelectedSlug}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
