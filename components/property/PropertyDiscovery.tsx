"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import AreaSelector from "@/components/property/AreaSelector";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";
import { formatINRPerMonth } from "@/lib/property-format";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type PropertyDiscoveryProps = {
  properties: DiscoveryProperty[];
};

type PropertyListProps = {
  properties: DiscoveryProperty[];
  heading: string;
  showToolbar?: boolean;
  compact?: boolean;
  scrollable?: boolean;
  areas?: string[];
};

type PropertyToolbarProps = {
  areas: string[];
  selectedArea: string | null;
  onAreaChange: (area: string | null) => void;
};

// Known gap: this stays a small, hand-picked subset for the sidebar below,
// separate from the full LOCALITIES_BY_CITY list used by the Area selector.
const localities = [
  "Koramangala",
  "HSR Layout",
  "Indiranagar",
  "Whitefield",
  "BTM Layout",
  "JP Nagar",
];

const staticFilterLabels = ["BHK", "Rent"];

const fieldInputClass =
  "min-w-0 flex-1 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 placeholder:text-slate-400";

export function filterPropertiesByArea(
  properties: DiscoveryProperty[],
  area: string | null,
): DiscoveryProperty[] {
  if (!area) return properties;

  return properties.filter((property) =>
    property.area.toLocaleLowerCase().includes(area.toLocaleLowerCase()),
  );
}

function formatRent(rent: number | null) {
  return rent === null ? "Rent on request" : formatINRPerMonth(rent);
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function RangeRow({
  minPlaceholder,
  maxPlaceholder,
}: {
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <input type="text" disabled placeholder={minPlaceholder} className={fieldInputClass} />
        <span className="text-slate-300">–</span>
        <input type="text" disabled placeholder={maxPlaceholder} className={fieldInputClass} />
      </div>
      <input type="range" disabled className="mt-3 w-full accent-blue-600 opacity-40" />
    </>
  );
}

function PillGroup({ options }: { options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled
          className="cursor-not-allowed rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-500"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function CheckboxGrid({
  options,
  columns,
}: {
  options: string[];
  columns: 1 | 2;
}) {
  return (
    <div className={`grid gap-2.5 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((option) => (
        <label key={option} className="flex cursor-not-allowed items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" disabled className="accent-blue-600" />
          {option}
        </label>
      ))}
    </div>
  );
}

function FiltersPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      id="filters-panel"
      role="dialog"
      aria-label="Filters"
      className="absolute right-0 z-30 mt-3 w-[min(90vw,26rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
    >
      <div className="max-h-[28rem] space-y-5 overflow-y-auto overscroll-contain pr-1">
        <FilterField label="Monthly rent">
          <RangeRow minPlaceholder="₹3,000" maxPlaceholder="₹10,00,000+" />
        </FilterField>
        <FilterField label="Security deposit">
          <RangeRow minPlaceholder="Any" maxPlaceholder="₹20,40,000+" />
          <p className="mt-2 text-xs text-slate-500">Deposit filtering is coming soon.</p>
        </FilterField>
        <FilterField label="Bedrooms">
          <PillGroup options={["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"]} />
        </FilterField>
        <FilterField label="Property type">
          <CheckboxGrid
            options={["Apartment", "Independent house", "Villa", "PG / Co-living", "Studio"]}
            columns={2}
          />
        </FilterField>
        <FilterField label="Furnishing">
          <PillGroup options={["Unfurnished", "Semi-furnished", "Fully furnished"]} />
        </FilterField>
        <FilterField label="Amenities">
          <CheckboxGrid
            options={["Lift", "Power backup", "Parking", "Gym", "Swimming pool", "Security", "Park", "Clubhouse"]}
            columns={2}
          />
          <p className="mt-2 text-xs text-slate-500">Amenity details are coming soon.</p>
        </FilterField>
        <FilterField label="Minimum area">
          <div className="flex items-center gap-2">
            <input type="text" disabled placeholder="e.g. 600" className={fieldInputClass} />
            <span className="text-sm text-slate-500">sq.ft</span>
          </div>
        </FilterField>
        <FilterField label="Listed on">
          <select disabled className={`${fieldInputClass} w-full`}>
            <option>Any time</option>
          </select>
        </FilterField>
        <FilterField label="Posted by">
          <PillGroup options={["Owner", "Broker", "Any"]} />
        </FilterField>
        <FilterField label="Only show">
          <CheckboxGrid
            options={["Verified properties", "Properties with reviews", "Properties with photos"]}
            columns={1}
          />
        </FilterField>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Filtering isn&apos;t live yet — this is a preview of what&apos;s coming.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-medium text-slate-900 hover:text-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function PropertyToolbar({ areas, selectedArea, onAreaChange }: PropertyToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFiltersOpen) return;

    const close = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setIsFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isFiltersOpen]);

  return (
    <div className="flex flex-wrap gap-2.5">
      <AreaSelector areas={areas} value={selectedArea} onChange={onAreaChange} />

      {staticFilterLabels.map((label) => (
        <button
          key={label}
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          {label}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
            Soon
          </span>
        </button>
      ))}

      <div ref={filtersRef} className="relative">
        <button
          type="button"
          onClick={() => setIsFiltersOpen((open) => !open)}
          aria-expanded={isFiltersOpen}
          aria-controls="filters-panel"
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
            isFiltersOpen
              ? "border-blue-600 bg-blue-600 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.45)]"
              : "border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:text-blue-600"
          }`}
        >
          Filters
        </button>
        {isFiltersOpen && <FiltersPanel onClose={() => setIsFiltersOpen(false)} />}
      </div>
    </div>
  );
}

export function PropertyList({
  properties,
  heading,
  showToolbar = false,
  compact = false,
  scrollable = false,
  areas = [],
}: PropertyListProps) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const visibleProperties = useMemo(
    () => filterPropertiesByArea(properties, selectedArea),
    [properties, selectedArea],
  );

  const grid = (
    <div className={`grid gap-4 sm:grid-cols-2 ${compact ? "" : "xl:grid-cols-3"}`}>
      {visibleProperties.map((property) => (
        <article
          key={property.slug}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]"
        >
          <div className="relative aspect-[2/1] bg-slate-100">
            {property.isAvailable && (
              <span className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Available for rent
              </span>
            )}
            {property.image ? (
              // The bucket accepts user uploads, so its public URLs are intentionally rendered directly.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.image.src}
                alt={property.image.alt}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-end bg-[linear-gradient(145deg,#e2e8f0,#f8fafc_58%,#dbeafe)] p-5">
                <span className="text-sm font-medium text-slate-500">
                  Property image coming soon
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-[0.13em] text-slate-500">
              {property.area}, {property.city}
            </p>
            <h3 className="mt-1.5 line-clamp-2 text-base font-medium tracking-[-0.02em] text-slate-950">
              {property.name}
            </h3>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-900">
                {property.averageRating === null
                  ? "New"
                  : `${property.averageRating.toFixed(1)} / 5`}
              </span>
              <span className="text-slate-500">
                {property.reviewCount}{" "}
                {property.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
            <p className="mt-2.5 text-sm font-medium text-slate-900">
              {formatRent(property.askingRent)}
            </p>
            <Link
              href={`/property/${property.slug}`}
              className="mt-3.5 inline-flex text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-600 hover:decoration-slate-900"
            >
              View Property
            </Link>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="property-results-heading">
      {showToolbar && (
        <PropertyToolbar
          areas={areas}
          selectedArea={selectedArea}
          onAreaChange={setSelectedArea}
        />
      )}

      <div
        className={`flex items-end justify-between gap-4 ${
          showToolbar ? "mt-8" : ""
        }`}
      >
        <div>
          <h2
            id="property-results-heading"
            className="text-2xl font-medium tracking-[-0.03em] text-slate-950"
          >
            {heading}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {visibleProperties.length} {visibleProperties.length === 1 ? "property" : "properties"}
          </p>
        </div>
      </div>

      {visibleProperties.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-900">No properties found here yet.</p>
          <p className="mt-2 text-sm text-slate-500">
            Try another locality or check back as the community grows.
          </p>
        </div>
      ) : scrollable ? (
        <div className="scroll-thin mt-6 lg:-mb-8 lg:-mr-8 lg:max-h-[21.75rem] lg:overflow-y-auto">
          <div className="lg:pr-8">{grid}</div>
        </div>
      ) : (
        <div className="mt-6">{grid}</div>
      )}
    </section>
  );
}

export default function PropertyDiscovery({
  properties,
}: PropertyDiscoveryProps) {
  const city = DEFAULT_CITY;
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);

  const visibleProperties = useMemo(
    () => filterPropertiesByArea(properties, selectedLocality),
    [properties, selectedLocality],
  );

  const searchProperties = properties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: `${property.area}, ${property.city}`,
  }));

  return (
    <main className="min-h-screen bg-[#fbfbfa] pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Property discovery
          </p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-0.045em] text-slate-950 sm:text-5xl">
            Find a place worth coming home to.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Explore rental homes and the tenant experiences behind each address.
          </p>
        </div>

        <div className="mt-9 max-w-3xl">
          <SearchBar properties={searchProperties} />
        </div>

        <div className="mt-5">
          <PropertyToolbar
            areas={LOCALITIES_BY_CITY[city] ?? []}
            selectedArea={selectedLocality}
            onAreaChange={setSelectedLocality}
          />
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,3fr)] lg:gap-14">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              Locality explorer
            </p>
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setSelectedLocality(null)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  selectedLocality === null
                    ? "bg-slate-950 font-medium text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                All {city}
              </button>
              {localities.map((locality) => (
                <button
                  key={locality}
                  type="button"
                  onClick={() => setSelectedLocality(locality)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selectedLocality === locality
                      ? "bg-slate-950 font-medium text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {locality}
                </button>
              ))}
            </div>
          </aside>

          <PropertyList
            properties={visibleProperties}
            heading={selectedLocality ?? `${city} properties`}
          />
        </div>
      </div>
    </main>
  );
}
