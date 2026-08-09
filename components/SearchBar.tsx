"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CitySelector from "@/components/CitySelector";

type SearchProperty = {
  slug: string;
  name: string;
  location: string;
};

type SearchBarProps = {
  properties: SearchProperty[];
  city?: string;
  onCityChange?: (city: string) => void;
  // Optional controlled search text, so a parent (HomeDiscovery) can use the
  // same query to filter the property list/map, not just this dropdown.
  // Uncontrolled by default — existing callers that don't pass these keep
  // exactly today's behavior.
  query?: string;
  onQueryChange?: (query: string) => void;
  // When false, the embedded CitySelector isn't rendered — used by
  // HomeSearch, which supplies its own city control alongside area chips.
  // Defaults to true so every existing caller is unaffected.
  showCityPicker?: boolean;
  // Rendered as the bar's leading flush segment(s), before the text input —
  // used by HomeSearch to place City + Area selectors inside the same bar
  // instead of as separate pills beside it. Ignored when showCityPicker is
  // true (that slot is CitySelector's).
  leadingContent?: React.ReactNode;
  // Slimmer bar (used by HomeSearch's unified search) instead of the
  // default 68px height. Defaults to false so existing callers are unaffected.
  compact?: boolean;
};

type DropdownPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
} | null;

export default function SearchBar({
  properties,
  city,
  onCityChange,
  query: externalQuery,
  onQueryChange,
  showCityPicker = true,
  leadingContent,
  compact = false,
}: SearchBarProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = externalQuery ?? internalSearch;
  const setSearch = onQueryChange ?? setInternalSearch;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const filteredResults = properties.filter((property) =>
    property.name.toLowerCase().includes(search.toLowerCase()),
  );
  const shouldShowDropdown = Boolean(search) && isDropdownOpen;

  function updateDropdownPosition() {
    const rect = searchRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom - 24;
    const spaceAbove = rect.top - 24;
    const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(96, Math.min(420, availableSpace));

    setDropdownPosition({
      left: rect.left,
      top: openAbove ? Math.max(12, rect.top - maxHeight - 12) : rect.bottom + 12,
      width: rect.width,
      maxHeight,
    });
  }

  useEffect(() => {
    resultRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    if (!shouldShowDropdown) return;

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [shouldShowDropdown]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!searchRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function selectProperty(property: SearchProperty) {
    router.push(`/property/${property.slug}`);
  }

  // Runs the same search a click on a suggestion would: prefer the
  // highlighted suggestion if the user has arrowed to one, otherwise fall
  // back to the top-ranked match for the current query.
  function performSearch() {
    const property = filteredResults[highlightedIndex >= 0 ? highlightedIndex : 0];
    if (property) selectProperty(property);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (!isDropdownOpen || filteredResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index === filteredResults.length - 1 ? 0 : index + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index <= 0 ? filteredResults.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      performSearch();
    }
  }

  const dropdown =
    shouldShowDropdown &&
    dropdownPosition &&
    createPortal(
      <div
        ref={panelRef}
        id="property-search-results"
        style={{
          left: dropdownPosition.left,
          top: dropdownPosition.top,
          width: dropdownPosition.width,
          maxHeight: dropdownPosition.maxHeight,
        }}
        className="fixed z-30 overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface shadow-2xl touch-pan-y"
        role="listbox"
      >
        {filteredResults.length > 0 ? (
          <>
            <div className="sticky top-0 border-b border-border-subtle bg-surface px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Search Results
            </div>
            {filteredResults.map((property, index) => (
              <div
                key={property.slug}
                id={`search-option-${index}`}
                ref={(element) => {
                  resultRefs.current[index] = element;
                }}
                onClick={() => selectProperty(property)}
                role="option"
                aria-selected={highlightedIndex === index}
                className={`cursor-pointer border-b border-border-subtle px-5 py-4 transition hover:bg-surface-raised last:border-b-0 ${
                  highlightedIndex === index ? "bg-surface-raised" : ""
                }`}
              >
                <p className="font-medium text-foreground">{property.name}</p>
                <p className="mt-1 text-sm text-muted">{property.location}</p>
              </div>
            ))}
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="font-medium text-foreground">
              No matching properties found
            </p>
            <p className="mt-2 text-sm text-muted">
              Try a locality, society, apartment, property, or landmark.
            </p>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={searchRef} className="w-full">
      <div
        className={`flex overflow-visible rounded-2xl border border-border-subtle bg-surface shadow-[0_16px_35px_-20px_rgba(255, 90, 54,0.3)] transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/25 ${
          compact ? "h-11" : "h-[68px]"
        }`}
      >
        {showCityPicker ? <CitySelector value={city} onChange={onCityChange} /> : leadingContent}
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsDropdownOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => search && setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search locality, society, apartment..."
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shouldShowDropdown}
          aria-controls="property-search-results"
          aria-activedescendant={
            highlightedIndex >= 0 ? `search-option-${highlightedIndex}` : undefined
          }
          className={`min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted outline-none ${
            compact ? "px-3.5 text-sm" : "px-5 text-[15px]"
          }`}
        />
        <button
          type="button"
          onClick={performSearch}
          aria-label="Search properties"
          className={`flex shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-accent/10 hover:text-accent ${
            compact ? "m-1 h-9 w-9" : "m-2 h-12 w-12"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={compact ? "h-4 w-4 fill-none stroke-current stroke-[1.8]" : "h-5 w-5 fill-none stroke-current stroke-[1.8]"}
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
      </div>
      {typeof document !== "undefined" && dropdown}
    </div>
  );
}
