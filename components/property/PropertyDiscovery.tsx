"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import CitySelector from "@/components/CitySelector";
import AreaSelector from "@/components/property/AreaSelector";
import DualRangeSlider from "@/components/property/DualRangeSlider";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";
import { formatINRPerMonth } from "@/lib/property-format";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type PropertyDiscoveryProps = {
  properties: DiscoveryProperty[];
};

type PropertyListProps = {
  // `properties` is expected to already be filtered (via filterProperties)
  // by the caller — PropertyList itself no longer owns any filter state or
  // renders a toolbar; it's purely a heading + scrollable grid. This keeps
  // exactly one place (the caller) responsible for filtering, whether
  // that's HomeDiscovery (homepage) or the default-exported PropertyDiscovery
  // below (/property page).
  properties: DiscoveryProperty[];
  heading: string;
  compact?: boolean;
  scrollable?: boolean;
  // Marker <-> card sync: which property (by slug) is currently selected,
  // and the callback to fire when a card is clicked/focused.
  selectedSlug?: string | null;
  onSelectProperty?: (slug: string | null) => void;
};

export type OnlyShowFilters = {
  reviewsOnly: boolean;
  photosOnly: boolean;
};

type FiltersButtonProps = {
  rentRange: [number, number];
  onRentRangeChange: (range: [number, number]) => void;
  onlyShow: OnlyShowFilters;
  onOnlyShowChange: (filters: OnlyShowFilters) => void;
};

type PropertyToolbarProps = {
  areas: string[];
  selectedArea: string | null;
  onAreaChange: (area: string | null) => void;
  rentRange: [number, number];
  onRentRangeChange: (range: [number, number]) => void;
  onlyShow: OnlyShowFilters;
  onOnlyShowChange: (filters: OnlyShowFilters) => void;
  city?: string;
  onCityChange?: (city: string) => void;
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

export const RENT_MIN = 3000;
export const RENT_MAX = 100000; // upper bound is treated as "no cap" (100,000+)
const RENT_STEP = 1000;

const fieldInputClass =
  "min-w-0 flex-1 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 placeholder:text-slate-400";

// The single filtering implementation shared by the property list and the
// map — both must derive from calling this once with the same state, never
// two separate filter passes, so they can never disagree about what counts
// as "visible."
export function filterProperties(
  properties: DiscoveryProperty[],
  filters: {
    // Empty array = no area filter. Non-empty = match ANY selected area
    // (multi-select), not all of them.
    areas: string[];
    rentRange: [number, number];
    onlyShow: OnlyShowFilters;
    query?: string;
  },
): DiscoveryProperty[] {
  const [rentMin, rentMax] = filters.rentRange;
  const query = filters.query?.trim().toLowerCase();
  const areas = filters.areas.map((area) => area.toLocaleLowerCase());

  return properties.filter((property) => {
    if (
      areas.length > 0 &&
      !areas.some((area) => property.area.toLocaleLowerCase().includes(area))
    ) {
      return false;
    }

    if (
      query &&
      !property.name.toLowerCase().includes(query) &&
      !property.area.toLowerCase().includes(query)
    ) {
      return false;
    }

    if (property.askingRent !== null) {
      if (property.askingRent < rentMin) return false;
      if (rentMax < RENT_MAX && property.askingRent > rentMax) return false;
    }

    if (filters.onlyShow.reviewsOnly && property.reviewCount === 0) return false;
    if (filters.onlyShow.photosOnly && property.image === null) return false;

    return true;
  });
}

function formatRent(rent: number | null) {
  return rent === null ? "Rent on request" : formatINRPerMonth(rent);
}

function formatRentSliderValue(value: number) {
  return value >= RENT_MAX ? `${formatINRPerMonth(value)}+` : formatINRPerMonth(value);
}

function formatDepositSliderValue(value: number) {
  return value >= 2000000 ? `₹${(value / 100000).toFixed(0)}L+` : `₹${value.toLocaleString("en-IN")}`;
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

// Interactive but not wired to real data: this project's schema has no
// bedroom/furnishing/property-type/amenities/posted-by fields on
// `properties` yet, so these toggle a purely local selected state (real UI
// feedback) without filtering the result list. Filtering these once the
// underlying columns exist is a follow-up, not a UI change.
function ToggleGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={isSelected}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              isSelected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-600"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ToggleCheckboxGrid({
  options,
  columns,
  selected,
  onToggle,
}: {
  options: string[];
  columns: 1 | 2;
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <div className={`grid gap-2.5 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            className="accent-blue-600"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

function useToggleSet(initial: string[] = []) {
  const [selected, setSelected] = useState<string[]>(initial);
  const toggle = (option: string) =>
    setSelected((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );
  return [selected, toggle] as const;
}

type FiltersPanelProps = {
  onClose: () => void;
  rentRange: [number, number];
  onRentRangeChange: (range: [number, number]) => void;
  onlyShow: OnlyShowFilters;
  onOnlyShowChange: (filters: OnlyShowFilters) => void;
  position: { top: number; right: number; width: number; maxHeight: number } | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
};

function FiltersPanel({
  onClose,
  rentRange,
  onRentRangeChange,
  onlyShow,
  onOnlyShowChange,
  position,
  panelRef,
}: FiltersPanelProps) {
  const [depositRange, setDepositRange] = useState<[number, number]>([0, 2000000]);
  const [bedrooms, toggleBedroom] = useToggleSet();
  const [propertyTypes, togglePropertyType] = useToggleSet();
  const [furnishing, toggleFurnishing] = useToggleSet();
  const [amenities, toggleAmenity] = useToggleSet();
  // Defaults to "Tenant": properties on RentalIntel are submitted by past
  // tenants, not owners/brokers listing vacancies, so that's the
  // product-accurate starting selection rather than nothing selected.
  const [postedBy, togglePostedBy] = useToggleSet(["Tenant"]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      id="filters-panel"
      role="dialog"
      aria-label="Filters"
      style={{
        top: position.top,
        right: position.right,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      className="fixed z-30 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
        <FilterField label="Monthly rent">
          <DualRangeSlider
            min={RENT_MIN}
            max={RENT_MAX}
            step={RENT_STEP}
            value={rentRange}
            onChange={onRentRangeChange}
            formatValue={formatRentSliderValue}
          />
        </FilterField>
        <FilterField label="Security deposit">
          <DualRangeSlider
            min={0}
            max={2000000}
            step={50000}
            value={depositRange}
            onChange={setDepositRange}
            formatValue={formatDepositSliderValue}
          />
          <p className="mt-2 text-xs text-slate-500">Deposit filtering is coming soon.</p>
        </FilterField>
        <FilterField label="Bedrooms">
          <ToggleGroup
            options={["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"]}
            selected={bedrooms}
            onToggle={toggleBedroom}
          />
        </FilterField>
        <FilterField label="Property type">
          <ToggleCheckboxGrid
            options={["Apartment", "Independent house", "Villa", "PG / Co-living", "Studio"]}
            columns={2}
            selected={propertyTypes}
            onToggle={togglePropertyType}
          />
        </FilterField>
        <FilterField label="Furnishing">
          <ToggleGroup
            options={["Unfurnished", "Semi-furnished", "Fully furnished"]}
            selected={furnishing}
            onToggle={toggleFurnishing}
          />
        </FilterField>
        <FilterField label="Amenities">
          <ToggleCheckboxGrid
            options={["Lift", "Power backup", "Parking", "Gym", "Swimming pool", "Security", "Park", "Clubhouse"]}
            columns={2}
            selected={amenities}
            onToggle={toggleAmenity}
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
          <ToggleGroup
            options={["Owner", "Broker", "Tenant"]}
            selected={postedBy}
            onToggle={togglePostedBy}
          />
        </FilterField>
        <FilterField label="Only show">
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={() => setVerifiedOnly((value) => !value)}
                className="accent-blue-600"
              />
              Verified properties
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyShow.reviewsOnly}
                onChange={() =>
                  onOnlyShowChange({ ...onlyShow, reviewsOnly: !onlyShow.reviewsOnly })
                }
                className="accent-blue-600"
              />
              Properties with reviews
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyShow.photosOnly}
                onChange={() =>
                  onOnlyShowChange({ ...onlyShow, photosOnly: !onlyShow.photosOnly })
                }
                className="accent-blue-600"
              />
              Properties with photos
            </label>
          </div>
        </FilterField>
      </div>
      <div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
        <p className="text-xs text-slate-500">
          Rent range and &quot;Only show&quot; filters apply live. Everything else previews what&apos;s coming.
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Standalone Filters button + portal panel — extracted from PropertyToolbar
// so the homepage's own toolbar row can place it directly (alongside
// UseMyLocationButton and the unified Search) without also getting
// PropertyToolbar's bundled City/Area selectors, which the homepage now
// renders separately as part of Search. /property page still gets this via
// PropertyToolbar below — same component, two call sites, no duplication.
export function FiltersButton({
  rentRange,
  onRentRangeChange,
  onlyShow,
  onOnlyShowChange,
}: FiltersButtonProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Same anchored-dropdown technique as SearchBar's results panel: clamp the
  // panel's height to whatever space is actually available below the button
  // (or above it, if there's more room there), instead of a fixed max-height
  // that assumes the button sits near the top of the viewport.
  function updatePosition() {
    const rect = filtersButtonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(window.innerWidth - 24, 384);
    const spaceBelow = window.innerHeight - rect.bottom - 24;
    const spaceAbove = rect.top - 24;
    const openAbove = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(200, Math.min(560, openAbove ? spaceAbove : spaceBelow));

    setPosition({
      top: openAbove ? Math.max(12, rect.top - maxHeight - 12) : rect.bottom + 12,
      right: Math.max(12, window.innerWidth - rect.right),
      width,
      maxHeight,
    });
  }

  useEffect(() => {
    if (!isFiltersOpen) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !filtersButtonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", close);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", close);
    };
  }, [isFiltersOpen]);

  return (
    <>
      <button
        ref={filtersButtonRef}
        type="button"
        onClick={() => setIsFiltersOpen((open) => !open)}
        aria-expanded={isFiltersOpen}
        aria-controls="filters-panel"
        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
          isFiltersOpen
            ? "border-blue-600 bg-blue-600 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.45)]"
            : "border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:text-blue-600"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
          <path d="M4 5h16l-6.5 8v5.5L10.5 21v-8L4 5z" strokeLinejoin="round" />
        </svg>
        Filters
      </button>
      {isFiltersOpen && (
        <FiltersPanel
          onClose={() => setIsFiltersOpen(false)}
          rentRange={rentRange}
          onRentRangeChange={onRentRangeChange}
          onlyShow={onlyShow}
          onOnlyShowChange={onOnlyShowChange}
          position={position}
          panelRef={panelRef}
        />
      )}
    </>
  );
}

export function PropertyToolbar({
  areas,
  selectedArea,
  onAreaChange,
  rentRange,
  onRentRangeChange,
  onlyShow,
  onOnlyShowChange,
  city,
  onCityChange,
}: PropertyToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {city && onCityChange && (
          <CitySelector value={city} onChange={onCityChange} variant="pill" />
        )}
        <AreaSelector areas={areas} value={selectedArea} onChange={onAreaChange} />
      </div>

      <FiltersButton
        rentRange={rentRange}
        onRentRangeChange={onRentRangeChange}
        onlyShow={onlyShow}
        onOnlyShowChange={onOnlyShowChange}
      />
    </div>
  );
}

export function PropertyList({
  properties,
  heading,
  compact = false,
  scrollable = false,
  selectedSlug = null,
  onSelectProperty,
}: PropertyListProps) {
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // `properties` is already filtered by the caller — this is the "visible"
  // set as-is, not re-derived here. See the PropertyListProps comment.
  const visibleProperties = properties;

  useEffect(() => {
    if (!selectedSlug) return;
    cardRefs.current[selectedSlug]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSlug]);

  const grid = (
    <div className={`grid gap-3 sm:grid-cols-2 ${compact ? "" : "xl:grid-cols-3"}`}>
      {visibleProperties.map((property) => (
        <article
          key={property.slug}
          ref={(element) => {
            cardRefs.current[property.slug] = element;
          }}
          onClick={() => onSelectProperty?.(property.slug)}
          className={`overflow-hidden rounded-xl border bg-white transition hover:border-slate-300 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ${
            onSelectProperty ? "cursor-pointer" : ""
          } ${
            selectedSlug === property.slug
              ? "border-blue-500 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
        >
          <div className="relative aspect-[5/2] bg-slate-100">
            {property.isAvailable && (
              <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-600/20">
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
              <div className="flex h-full items-end bg-[linear-gradient(145deg,#e2e8f0,#f8fafc_58%,#dbeafe)] p-3">
                <span className="text-xs font-medium text-slate-500">
                  Property image coming soon
                </span>
              </div>
            )}
          </div>
          <div className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              {property.area}, {property.city}
            </p>
            <h3 className="mt-1 line-clamp-2 text-sm font-medium tracking-[-0.02em] text-slate-950">
              {property.name}
            </h3>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
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
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatRent(property.askingRent)}
            </p>
            <Link
              href={`/property/${property.slug}`}
              className="mt-2.5 inline-flex text-xs font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-600 hover:decoration-slate-900"
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
      <div className="flex items-end justify-between gap-4">
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
  const [rentRange, setRentRange] = useState<[number, number]>([RENT_MIN, RENT_MAX]);
  const [onlyShow, setOnlyShow] = useState<OnlyShowFilters>({
    reviewsOnly: false,
    photosOnly: false,
  });

  const visibleProperties = useMemo(
    () =>
      filterProperties(properties, {
        areas: selectedLocality ? [selectedLocality] : [],
        rentRange,
        onlyShow,
      }),
    [properties, selectedLocality, rentRange, onlyShow],
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
            rentRange={rentRange}
            onRentRangeChange={setRentRange}
            onlyShow={onlyShow}
            onOnlyShowChange={setOnlyShow}
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
