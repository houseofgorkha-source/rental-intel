"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import HomeSearch from "@/components/property/HomeSearch";
import DualRangeSlider from "@/components/property/DualRangeSlider";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import { formatINRPerMonth } from "@/lib/property-format";
import {
  FURNISHING_OPTIONS,
  POSTED_BY_OPTIONS,
  PROPERTY_CONFIGURATIONS,
  PROPERTY_TYPES,
  type Furnishing,
  type PostedBy,
  type PropertyConfiguration,
  type PropertyType,
} from "@/lib/property-attributes";
import type { DiscoveryProperty } from "@/lib/property-discovery";

// Seeded from app/property/page.tsx's searchParams (and, optionally, values
// carried over from DetailPageSearch on the property detail page) so a
// search is shareable/bookmarkable as a real URL, not just in-memory state.
export type PropertySearchParams = {
  city?: string;
  areas?: string[];
  query?: string;
  rentMin?: number;
  rentMax?: number;
  depositMin?: number;
  depositMax?: number;
  configurations?: PropertyConfiguration[];
  propertyTypes?: PropertyType[];
  furnishing?: Furnishing[];
  minAreaSqft?: number;
  listedWithinDays?: number;
  postedBy?: PostedBy[];
  reviewsOnly?: boolean;
  photosOnly?: boolean;
};

type PropertyDiscoveryProps = {
  properties: DiscoveryProperty[];
  initialSearch?: PropertySearchParams;
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

// Every filter the panel offers, in one object owned by the page.
//
// This used to be split: `rentRange` and `onlyShow` were lifted to the caller
// and reached filterProperties, while bedrooms, property type, furnishing,
// minimum area and "Posted by" lived in FiltersPanel's own useState and
// reached nothing at all. Selecting "Tenant" highlighted a chip and changed
// no results — and because the panel unmounts when it closes, the selection
// silently reset too. Holding all of them here is what makes the panel a
// filter rather than a set of toggles.
export type PropertyFilters = {
  rentRange: [number, number];
  depositRange: [number, number];
  configurations: PropertyConfiguration[];
  propertyTypes: PropertyType[];
  furnishing: Furnishing[];
  minAreaSqft: number | null;
  listedWithinDays: number | null;
  postedBy: PostedBy[];
  onlyShow: OnlyShowFilters;
};

type FiltersButtonProps = {
  filters: PropertyFilters;
  onFiltersChange: (filters: PropertyFilters) => void;
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

export const DEPOSIT_MIN = 0;
export const DEPOSIT_MAX = 2000000; // upper bound is treated as "no cap"
const DEPOSIT_STEP = 50000;

// "Any time" is null rather than a very large number, so the filter is either
// applied or absent — never applied with a value chosen to be harmless.
const LISTED_ON_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Any time", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 3 months", days: 90 },
  { label: "Last 6 months", days: 180 },
];

// Nothing selected. Notably `postedBy` starts empty: it previously defaulted
// to ["Tenant"], which rendered as an active chip. Had that selection ever
// been wired to the query, it would have hidden every owner listing on the
// site by default — the filter looked applied and was not.
export const DEFAULT_FILTERS: PropertyFilters = {
  rentRange: [RENT_MIN, RENT_MAX],
  depositRange: [DEPOSIT_MIN, DEPOSIT_MAX],
  configurations: [],
  propertyTypes: [],
  furnishing: [],
  minAreaSqft: null,
  listedWithinDays: null,
  postedBy: [],
  onlyShow: { reviewsOnly: false, photosOnly: false },
};

// Drives the count badge on the Filters chip. A filter counts as active when
// it excludes something, which is why the ranges compare against their bounds
// rather than just being non-null.
export function countActiveFilters(filters: PropertyFilters): number {
  return [
    filters.rentRange[0] !== RENT_MIN || filters.rentRange[1] !== RENT_MAX,
    filters.depositRange[0] !== DEPOSIT_MIN || filters.depositRange[1] !== DEPOSIT_MAX,
    filters.configurations.length > 0,
    filters.propertyTypes.length > 0,
    filters.furnishing.length > 0,
    filters.minAreaSqft !== null,
    filters.listedWithinDays !== null,
    filters.postedBy.length > 0,
    filters.onlyShow.reviewsOnly,
    filters.onlyShow.photosOnly,
  ].filter(Boolean).length;
}

// These two inputs were previously `disabled` and styled to look it. They
// filter for real now, so they get the same live treatment as every other
// control in the panel.
const fieldInputClass =
  "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

// The single filtering implementation shared by the property list and the
// map — both must derive from calling this once with the same state, never
// two separate filter passes, so they can never disagree about what counts
// as "visible."
export function filterProperties(
  properties: DiscoveryProperty[],
  options: {
    // Empty array = no area filter. Non-empty = match ANY selected area
    // (multi-select), not all of them.
    areas: string[];
    query?: string;
    filters: PropertyFilters;
  },
): DiscoveryProperty[] {
  const { filters } = options;
  const [rentMin, rentMax] = filters.rentRange;
  const [depositMin, depositMax] = filters.depositRange;
  const query = options.query?.trim().toLowerCase();
  const areas = options.areas.map((area) => area.toLocaleLowerCase());

  // Resolved once rather than per property, so every row is measured against
  // the same instant.
  const listedAfter =
    filters.listedWithinDays === null
      ? null
      : Date.now() - filters.listedWithinDays * 24 * 60 * 60 * 1000;

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

    // A null price is "not stated", not "free" — an unpriced property stays
    // in the results rather than being excluded by a range it cannot answer.
    // This is the pre-existing rent behaviour, applied to deposit too.
    if (property.askingRent !== null) {
      if (property.askingRent < rentMin) return false;
      if (rentMax < RENT_MAX && property.askingRent > rentMax) return false;
    }

    if (property.securityDeposit !== null) {
      if (property.securityDeposit < depositMin) return false;
      if (depositMax < DEPOSIT_MAX && property.securityDeposit > depositMax) return false;
    }

    // The attribute filters work the other way round: selecting "2 BHK" is a
    // positive claim about what you want, and a property that never told us
    // its configuration cannot satisfy it. Including nulls here would fill a
    // "2 BHK" search with properties that might be anything.
    if (
      filters.configurations.length > 0 &&
      (property.configuration === null ||
        !filters.configurations.includes(property.configuration))
    ) {
      return false;
    }

    if (
      filters.propertyTypes.length > 0 &&
      (property.propertyType === null ||
        !filters.propertyTypes.includes(property.propertyType))
    ) {
      return false;
    }

    if (
      filters.furnishing.length > 0 &&
      (property.furnishing === null || !filters.furnishing.includes(property.furnishing))
    ) {
      return false;
    }

    if (
      filters.minAreaSqft !== null &&
      (property.carpetAreaSqft === null || property.carpetAreaSqft < filters.minAreaSqft)
    ) {
      return false;
    }

    // Provenance comes from `submitted_as`, the column that already records
    // it. A legacy row with unknown provenance is excluded from a positive
    // "Posted by" filter for the same reason as the attributes above.
    if (
      filters.postedBy.length > 0 &&
      (property.submittedAs === null || !filters.postedBy.includes(property.submittedAs))
    ) {
      return false;
    }

    if (listedAfter !== null && new Date(property.createdAt).getTime() < listedAfter) {
      return false;
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

// Generic over the option type so a chip group can only ever be given values
// from the matching canonical list (lib/property-attributes.ts). A typo like
// "1RK" is a compile error rather than a chip that quietly matches nothing.
function ToggleGroup<T extends string>({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: readonly T[];
  selected: readonly T[];
  onToggle: (option: T) => void;
  labelFor?: (option: T) => string;
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
            {labelFor ? labelFor(option) : option}
          </button>
        );
      })}
    </div>
  );
}

function ToggleCheckboxGrid<T extends string>({
  options,
  columns,
  selected,
  onToggle,
}: {
  options: readonly T[];
  columns: 1 | 2;
  selected: readonly T[];
  onToggle: (option: T) => void;
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

// Amenities is the one group still without a data model — it has no column,
// no table, and no requirement asking for one. It stays local and clearly
// labelled "coming soon" rather than being wired to nothing while looking
// identical to the filters that work.
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
  filters: PropertyFilters;
  onFiltersChange: (filters: PropertyFilters) => void;
  position: { top: number; right: number; width: number; maxHeight: number } | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
};

function FiltersPanel({
  onClose,
  filters,
  onFiltersChange,
  position,
  panelRef,
}: FiltersPanelProps) {
  const [amenities, toggleAmenity] = useToggleSet();

  // One updater for every group, so a new filter cannot be added and then
  // forgotten on the way back up to the page's state — which is exactly how
  // the previous version's selections got stranded inside this component.
  function update<K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function toggleIn<T extends string>(key: keyof PropertyFilters, list: readonly T[], option: T) {
    const next = list.includes(option)
      ? list.filter((item) => item !== option)
      : [...list, option];
    onFiltersChange({ ...filters, [key]: next });
  }

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
            value={filters.rentRange}
            onChange={(range) => update("rentRange", range)}
            formatValue={formatRentSliderValue}
          />
        </FilterField>
        <FilterField label="Security deposit">
          <DualRangeSlider
            min={DEPOSIT_MIN}
            max={DEPOSIT_MAX}
            step={DEPOSIT_STEP}
            value={filters.depositRange}
            onChange={(range) => update("depositRange", range)}
            formatValue={formatDepositSliderValue}
          />
        </FilterField>
        {/* Labelled "Configuration", not "Bedrooms": 1 RK has no bedroom at
            all, so a bedroom count cannot name the thing being chosen. */}
        <FilterField label="Configuration">
          <ToggleGroup
            options={PROPERTY_CONFIGURATIONS}
            selected={filters.configurations}
            onToggle={(option) =>
              toggleIn("configurations", filters.configurations, option)
            }
          />
        </FilterField>
        <FilterField label="Property type">
          <ToggleCheckboxGrid
            options={PROPERTY_TYPES}
            columns={2}
            selected={filters.propertyTypes}
            onToggle={(option) => toggleIn("propertyTypes", filters.propertyTypes, option)}
          />
        </FilterField>
        <FilterField label="Furnishing">
          <ToggleGroup
            options={FURNISHING_OPTIONS}
            selected={filters.furnishing}
            onToggle={(option) => toggleIn("furnishing", filters.furnishing, option)}
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
            <input
              type="number"
              min="0"
              step="50"
              inputMode="numeric"
              placeholder="e.g. 600"
              value={filters.minAreaSqft ?? ""}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                // Blank and 0 both mean "no minimum" — an area filter of zero
                // excludes nothing but would still count as active.
                update(
                  "minAreaSqft",
                  event.target.value === "" || !Number.isFinite(parsed) || parsed <= 0
                    ? null
                    : Math.round(parsed),
                );
              }}
              className={fieldInputClass}
            />
            <span className="text-sm text-slate-500">sq.ft</span>
          </div>
        </FilterField>
        <FilterField label="Listed on">
          <select
            value={filters.listedWithinDays ?? ""}
            onChange={(event) =>
              update("listedWithinDays", event.target.value === "" ? null : Number(event.target.value))
            }
            className={`${fieldInputClass} w-full`}
          >
            {LISTED_ON_OPTIONS.map((option) => (
              <option key={option.label} value={option.days ?? ""}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            When the property was added to RentalIntel.
          </p>
        </FilterField>
        {/* Backed by `submitted_as`, the provenance already recorded at
            submission. There is no "Broker" chip any more: RentalIntel has no
            broker role, so it could never have matched a property. */}
        <FilterField label="Posted by">
          <ToggleGroup
            options={POSTED_BY_OPTIONS.map((option) => option.value)}
            selected={filters.postedBy}
            onToggle={(option) => toggleIn("postedBy", filters.postedBy, option)}
            labelFor={(value) =>
              POSTED_BY_OPTIONS.find((option) => option.value === value)?.label ?? value
            }
          />
        </FilterField>
        <FilterField label="Only show">
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyShow.reviewsOnly}
                onChange={() =>
                  update("onlyShow", {
                    ...filters.onlyShow,
                    reviewsOnly: !filters.onlyShow.reviewsOnly,
                  })
                }
                className="accent-blue-600"
              />
              Properties with reviews
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyShow.photosOnly}
                onChange={() =>
                  update("onlyShow", {
                    ...filters.onlyShow,
                    photosOnly: !filters.onlyShow.photosOnly,
                  })
                }
                className="accent-blue-600"
              />
              Properties with photos
            </label>
          </div>
        </FilterField>
      </div>
      <div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
        {/* Every filter applies as it is changed, so there is no "Apply" any
            more — a button that applied nothing was part of why the panel
            looked like it worked. "Reset all" is what the old Apply slot is
            worth: the one action the panel could not otherwise offer. */}
        <p className="text-xs text-slate-500">
          Filters apply as you change them. Amenities are still coming soon.
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Close
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
export function FiltersButton({ filters, onFiltersChange }: FiltersButtonProps) {
  const activeCount = countActiveFilters(filters);
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
        {/* The panel closes over the results, so without this the only way to
            tell whether a filter is narrowing the list is to reopen it. */}
        {activeCount > 0 && (
          <span
            aria-label={`${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`}
            className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
              isFiltersOpen ? "bg-white text-blue-600" : "bg-blue-600 text-white"
            }`}
          >
            {activeCount}
          </span>
        )}
      </button>
      {isFiltersOpen && (
        <FiltersPanel
          onClose={() => setIsFiltersOpen(false)}
          filters={filters}
          onFiltersChange={onFiltersChange}
          position={position}
          panelRef={panelRef}
        />
      )}
    </>
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
        // One destination, so the whole card is a single link — no inner
        // "View Property" link nested inside a clickable container, which
        // previously fired navigation and selection together and left the
        // card unreachable by keyboard. Map highlighting moved to hover and
        // focus: pointing at a card is the intent to preview it, clicking it
        // is the intent to open it. Marker click -> selection and the
        // scrollIntoView sync are unchanged.
        <article
          key={property.slug}
          ref={(element) => {
            cardRefs.current[property.slug] = element;
          }}
          onMouseEnter={() => onSelectProperty?.(property.slug)}
          onFocus={() => onSelectProperty?.(property.slug)}
          className={`overflow-hidden rounded-xl border bg-white transition hover:border-slate-300 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 ${
            selectedSlug === property.slug
              ? "border-blue-500 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
        >
          <Link href={`/property/${property.slug}`} className="block focus:outline-none">
          <div className="relative aspect-[5/2] bg-slate-100">
            {/* Only shown for owner listings: a tenant contributing the flat
                they live in isn't advertising a vacancy, so badging it
                "Available for rent" would be false. Legacy rows have a null
                submittedAs and correctly show nothing. */}
            {property.submittedAs === "owner" && property.isAvailable && (
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
          </div>
          </Link>
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
  initialSearch,
}: PropertyDiscoveryProps) {
  const [selectedCity, setSelectedCity] = useState(initialSearch?.city ?? DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialSearch?.areas ?? []);
  const [searchQuery, setSearchQuery] = useState(initialSearch?.query ?? "");
  const [filters, setFilters] = useState<PropertyFilters>(() => ({
    ...DEFAULT_FILTERS,
    rentRange: [
      initialSearch?.rentMin ?? RENT_MIN,
      initialSearch?.rentMax ?? RENT_MAX,
    ],
    depositRange: [
      initialSearch?.depositMin ?? DEPOSIT_MIN,
      initialSearch?.depositMax ?? DEPOSIT_MAX,
    ],
    configurations: initialSearch?.configurations ?? [],
    propertyTypes: initialSearch?.propertyTypes ?? [],
    furnishing: initialSearch?.furnishing ?? [],
    minAreaSqft: initialSearch?.minAreaSqft ?? null,
    listedWithinDays: initialSearch?.listedWithinDays ?? null,
    postedBy: initialSearch?.postedBy ?? [],
    onlyShow: {
      reviewsOnly: initialSearch?.reviewsOnly ?? false,
      photosOnly: initialSearch?.photosOnly ?? false,
    },
  }));

  // `properties` is fetched once for DEFAULT_CITY (see app/property/page.tsx),
  // the same pattern the homepage uses — every other city is filtered down
  // to empty here, which is correct today since only Bengaluru has real data
  // (see lib/cities.ts's `available` flags).
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

  function handleCityChange(city: string) {
    setSelectedCity(city);
    setSelectedAreas([]);
  }

  // This page is the canonical search results surface: search, filters, map,
  // results — nothing else. No landing/marketing copy here (that's the
  // homepage's job) — the H1 stays purely functional, reflecting the current
  // search rather than pitching the product.
  const resultsHeading =
    selectedAreas.length === 1 ? `${selectedAreas[0]}, ${selectedCity}` : `${selectedCity} properties`;

  return (
    <main className="min-h-screen bg-[#fbfbfa] pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h1 className="text-3xl font-medium tracking-[-0.03em] text-slate-950 sm:text-4xl">
          {resultsHeading}
        </h1>

        <div className="mt-6 flex flex-wrap items-start gap-3">
          <HomeSearch
            properties={searchProperties}
            city={selectedCity}
            onCityChange={handleCityChange}
            areas={LOCALITIES_BY_CITY[selectedCity] ?? []}
            selectedAreas={selectedAreas}
            onAreasChange={setSelectedAreas}
            query={searchQuery}
            onQueryChange={setSearchQuery}
          />
          <FiltersButton filters={filters} onFiltersChange={setFilters} />
        </div>

        {cityProperties.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            {selectedCity === DEFAULT_CITY
              ? "No properties are available yet."
              : `${selectedCity} is coming soon. Try ${DEFAULT_CITY} for now.`}
          </p>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,3fr)] lg:gap-14">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              Locality explorer
            </p>
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setSelectedAreas([])}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  selectedAreas.length === 0
                    ? "bg-slate-950 font-medium text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                All {selectedCity}
              </button>
              {localities.map((locality) => (
                <button
                  key={locality}
                  type="button"
                  onClick={() => setSelectedAreas([locality])}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selectedAreas.length === 1 && selectedAreas[0] === locality
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
            heading={selectedAreas.length === 1 ? selectedAreas[0] : `${selectedCity} properties`}
          />
        </div>
      </div>
    </main>
  );
}
