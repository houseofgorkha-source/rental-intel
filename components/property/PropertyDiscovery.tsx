"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import HomeSearch from "@/components/property/HomeSearch";
import DualRangeSlider from "@/components/property/DualRangeSlider";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import { formatINRPerMonth } from "@/lib/property-format";
import {
  AMENITIES,
  FURNISHING_OPTIONS,
  POSTED_BY_OPTIONS,
  PROPERTY_CONFIGURATIONS,
  PROPERTY_TYPES,
  type Amenity,
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
  amenities?: Amenity[];
  minAreaSqft?: number;
  listedWithinDays?: number;
  postedBy?: PostedBy[];
  reviewsOnly?: boolean;
  photosOnly?: boolean;
  sort?: SortOption;
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
  // and the callback to fire when a card is hovered/focused (a preview --
  // pans the map, does not open a popup).
  selectedSlug?: string | null;
  onSelectProperty?: (slug: string | null) => void;
  // Fires only on an actual click on the card body (not hover/focus) --
  // the stronger "I mean this one" signal that opens the map popup. Optional
  // because /property's PropertyList has no map to react to it.
  onActivateProperty?: (slug: string) => void;
  // Rendered on the right side of the (sticky, when compact) heading row —
  // used by HomeDiscovery to put a mobile-only Filters trigger next to the
  // results it filters, instead of duplicating a second copy of the toolbar's
  // FiltersButton state. Undefined everywhere else, including /property's
  // own PropertyList, which keeps its Filters button in the toolbar only.
  headerAction?: React.ReactNode;
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
  amenities: Amenity[];
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
  amenities: [],
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
    filters.amenities.length > 0,
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
  "min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

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

    // Unlike the single-value attributes above, a property can have several
    // amenities and a search can want several too — so this is "has ALL of
    // the selected amenities," not "has any of them." Selecting both "Lift"
    // and "Gym" should narrow the results, not widen them back out to
    // anything with either one.
    if (
      filters.amenities.length > 0 &&
      !filters.amenities.every((amenity) => property.amenities.includes(amenity))
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

// Ordering, not narrowing — kept as its own single implementation for the
// same reason filterProperties is one function rather than one per caller:
// the list and any future consumer of the sorted order must never disagree
// about what "sorted" means.
export type SortOption = "newest" | "rent_asc" | "rent_desc" | "rating_desc" | "most_reviewed";

// `null` is its own option ("Featured"): the order getDiscoveryProperties
// already returns (alphabetical by name), not a sort this file invents an
// opinion about. Keeping it distinct from "newest" means there is still a
// way to ask for "no particular order" instead of silently defaulting to one.
export const SORT_OPTIONS: { value: SortOption | null; label: string }[] = [
  { value: null, label: "Featured" },
  { value: "newest", label: "Newest first" },
  { value: "rent_asc", label: "Rent: low to high" },
  { value: "rent_desc", label: "Rent: high to low" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "most_reviewed", label: "Most reviewed" },
];

export function isSortOption(value: string): value is SortOption {
  return SORT_OPTIONS.some((option) => option.value === value);
}

// A null price/rating is "not stated," not "worst" — it is excluded from the
// comparison entirely and always sorts after every property that answered,
// regardless of which direction the sort runs. Otherwise "Rent: low to high"
// would put every unpriced property first, ahead of the cheapest real rent.
function compareNullsLast(
  a: number | null,
  b: number | null,
  compare: (x: number, y: number) => number,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

export function sortProperties(
  properties: DiscoveryProperty[],
  sortBy: SortOption | null,
): DiscoveryProperty[] {
  if (!sortBy) return properties;

  const sorted = [...properties];

  switch (sortBy) {
    case "newest":
      sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    case "rent_asc":
      sorted.sort((a, b) => compareNullsLast(a.askingRent, b.askingRent, (x, y) => x - y));
      break;
    case "rent_desc":
      sorted.sort((a, b) => compareNullsLast(a.askingRent, b.askingRent, (x, y) => y - x));
      break;
    case "rating_desc":
      sorted.sort((a, b) =>
        compareNullsLast(a.averageRating, b.averageRating, (x, y) => y - x),
      );
      break;
    case "most_reviewed":
      sorted.sort((a, b) => b.reviewCount - a.reviewCount);
      break;
  }

  return sorted;
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
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted">
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
                ? "border-accent bg-accent text-white"
                : "border-border-subtle bg-surface text-muted hover:border-accent/30 hover:text-accent"
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
        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-muted">
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
      className="fixed z-30 flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
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
            options={AMENITIES}
            columns={2}
            selected={filters.amenities}
            onToggle={(option) => toggleIn("amenities", filters.amenities, option)}
          />
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
            <span className="text-sm text-muted">sq.ft</span>
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
          <p className="mt-2 text-xs text-muted">
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
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
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
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
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
      <div className="shrink-0 space-y-3 border-t border-border-subtle p-4">
        {/* Every filter applies as it is changed, so there is no "Apply" any
            more — a button that applied nothing was part of why the panel
            looked like it worked. "Reset all" is what the old Apply slot is
            worth: the one action the panel could not otherwise offer. */}
        <p className="text-xs text-muted">
          Filters apply as you change them.
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
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

    // `right` right-aligns the panel to the button, but on a narrow viewport
    // that alignment can push the panel's implied LEFT edge past 0 if the
    // button isn't flush against the viewport's own right edge (e.g. the
    // button sits inside a padded card, not glued to the screen edge) — the
    // panel is wide enough that anchoring purely by "distance from the
    // button" ignores how much room is actually left for it. Capping `right`
    // at `innerWidth - width - 12` guarantees a 12px left margin no matter
    // where the button is.
    const right = Math.max(
      12,
      Math.min(window.innerWidth - rect.right, window.innerWidth - width - 12),
    );

    setPosition({
      top: openAbove ? Math.max(12, rect.top - maxHeight - 12) : rect.bottom + 12,
      right,
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
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5 text-xs font-medium transition sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm ${
          isFiltersOpen
            ? "border-accent bg-accent text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.45)]"
            : "border-border-subtle bg-surface text-muted shadow-[0_1px_2px_rgba(14,143,94,0.04)] hover:border-accent/30 hover:text-accent"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8] sm:h-4 sm:w-4">
          <path d="M4 5h16l-6.5 8v5.5L10.5 21v-8L4 5z" strokeLinejoin="round" />
        </svg>
        Filters
        {/* The panel closes over the results, so without this the only way to
            tell whether a filter is narrowing the list is to reopen it. */}
        {activeCount > 0 && (
          <span
            aria-label={`${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`}
            className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
              isFiltersOpen ? "bg-surface text-accent" : "bg-accent text-white"
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
  onActivateProperty,
  headerAction,
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
    <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${compact ? "" : "xl:grid-cols-3"}`}>
      {visibleProperties.map((property) => (
        // The card body is a click target for map preview (mouse-only — see
        // onActivateProperty) but deliberately NOT itself a link: an earlier
        // version nested a "View Property" link inside a whole-card link,
        // which fired navigation and selection together and left the card
        // unreachable by keyboard. The one real link is "View property"
        // below, a normal tab stop. Hovering/focusing still previews on the
        // map (pans only); clicking the card body also opens the marker's
        // popup, same as clicking the marker itself would.
        <article
          key={property.slug}
          ref={(element) => {
            cardRefs.current[property.slug] = element;
          }}
          onMouseEnter={() => onSelectProperty?.(property.slug)}
          onFocus={() => onSelectProperty?.(property.slug)}
          onClick={() => {
            onSelectProperty?.(property.slug);
            onActivateProperty?.(property.slug);
          }}
          className={`overflow-hidden rounded-xl border bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
            selectedSlug === property.slug
              ? "border-accent ring-2 ring-accent/25"
              : "border-border-subtle"
          } ${onActivateProperty ? "cursor-pointer" : ""}`}
        >
          <div className="relative aspect-[5/2] bg-surface-raised">
            {/* Only shown for owner listings: a tenant contributing the flat
                they live in isn't advertising a vacancy, so badging it
                "Available for rent" would be false. Legacy rows have a null
                submittedAs and correctly show nothing. */}
            {property.submittedAs === "owner" && property.isAvailable && (
              <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-medium text-success shadow-sm ring-1 ring-inset ring-emerald-600/20">
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
              <div className="flex h-full items-end bg-[linear-gradient(145deg,#eef5f0,#fbfdfb_58%,#dbe9e0)] p-3">
                <span className="text-xs font-medium text-muted">
                  Property image coming soon
                </span>
              </div>
            )}
          </div>
          <div className="p-2 sm:p-3">
            <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted sm:text-[11px] sm:tracking-[0.12em]">
              {property.area}, {property.city}
            </p>
            <h3 className="mt-1 line-clamp-2 text-xs font-medium tracking-[-0.01em] text-foreground sm:text-sm sm:tracking-[-0.02em]">
              {property.name}
            </h3>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] sm:mt-2 sm:gap-3 sm:text-xs">
              <span className="font-medium text-foreground">
                {property.averageRating === null
                  ? "New"
                  : `${property.averageRating.toFixed(1)} / 5`}
              </span>
              <span className="text-muted">
                {property.reviewCount}{" "}
                {property.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-foreground sm:mt-2 sm:text-sm">
              {formatRent(property.askingRent)}
            </p>
            <Link
              href={`/property/${property.slug}`}
              className="group/view mt-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-all duration-200 hover:gap-2 hover:bg-accent hover:text-white sm:mt-3 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              View property
              <span aria-hidden="true" className="transition-transform duration-200 group-hover/view:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section
      aria-labelledby="property-results-heading"
      // `compact` is exactly the homepage's bounded-scroll usage (see
      // HomeDiscovery). This is a flex column specifically so the heading
      // below can take its own natural height and the scrollable grid box
      // further down can claim exactly what's left via `flex-1` — no
      // `position: sticky` involved anywhere. /property's own (non-compact,
      // page-scrolled) PropertyList is unaffected (no className below).
      className={compact ? "flex flex-col lg:h-full lg:min-h-0" : undefined}
    >
      <div className={`flex items-end justify-between gap-1.5 sm:gap-4 ${compact ? "pb-3" : ""}`}>
        <div className="min-w-0">
          <h2
            id="property-results-heading"
            className="truncate text-sm font-medium tracking-[-0.01em] text-foreground sm:text-2xl sm:tracking-[-0.03em]"
          >
            {heading}
          </h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {visibleProperties.length} {visibleProperties.length === 1 ? "property" : "properties"}
          </p>
        </div>
        {headerAction}
      </div>

      {visibleProperties.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-8 text-center sm:py-12 ${
            compact ? "" : "mt-4 sm:mt-6"
          }`}
        >
          <p className="font-medium text-foreground">No properties found here yet.</p>
          <p className="mt-2 text-sm text-muted">
            Try another locality or check back as the community grows.
          </p>
        </div>
      ) : compact ? (
        // The heading above is a normal, statically-positioned element —
        // never part of the scrolling area. Only this box scrolls, so a
        // card can never render above the heading no matter what: they're
        // not in the same scroll region, there's nothing for a card to
        // "escape" out of. Deliberately not `position: sticky` — sticky
        // inside a scrolling container that's also a CSS Grid cell (see
        // HomeDiscovery's map|list grid) is a known trouble spot where
        // scrolled content can intermittently render above the "stuck"
        // element instead of staying hidden behind it.
        <div className="scroll-thin max-h-[24rem] flex-1 overflow-y-auto lg:max-h-none lg:min-h-0">
          {grid}
        </div>
      ) : scrollable ? (
        <div className="scroll-thin mt-4 sm:mt-6 lg:-mb-8 lg:-mr-8 lg:max-h-[21.75rem] lg:overflow-y-auto">
          <div className="lg:pr-8">{grid}</div>
        </div>
      ) : (
        <div className="mt-4 sm:mt-6">{grid}</div>
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
  const [sortBy, setSortBy] = useState<SortOption | null>(initialSearch?.sort ?? null);
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
    amenities: initialSearch?.amenities ?? [],
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
      sortProperties(
        filterProperties(cityProperties, {
          areas: selectedAreas,
          query: searchQuery,
          filters,
        }),
        sortBy,
      ),
    [cityProperties, selectedAreas, filters, searchQuery, sortBy],
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
    <main className="min-h-screen bg-background pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h1 className="text-3xl font-medium tracking-[-0.03em] text-foreground sm:text-4xl">
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
          <select
            value={sortBy ?? ""}
            onChange={(event) =>
              setSortBy(event.target.value ? (event.target.value as SortOption) : null)
            }
            aria-label="Sort properties by"
            className="rounded-full border border-border-subtle bg-surface px-2 py-1.5 text-xs font-medium text-muted shadow-[0_1px_2px_rgba(14,143,94,0.04)] transition hover:border-accent/30 hover:text-accent focus:border-accent focus:outline-none sm:px-4 sm:py-2 sm:text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ""}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {cityProperties.length === 0 && (
          <p className="mt-4 text-sm text-muted">
            {selectedCity === DEFAULT_CITY
              ? "No properties are available yet."
              : `${selectedCity} is coming soon. Try ${DEFAULT_CITY} for now.`}
          </p>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,3fr)] lg:gap-14">
          <aside className="rounded-2xl border border-border-subtle bg-surface p-5 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">
              Locality explorer
            </p>
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => setSelectedAreas([])}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  selectedAreas.length === 0
                    ? "bg-accent font-medium text-white"
                    : "text-muted hover:bg-surface-raised"
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
                      ? "bg-accent font-medium text-white"
                      : "text-muted hover:bg-surface-raised"
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
