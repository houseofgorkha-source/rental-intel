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
};

type DropdownPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
} | null;

export default function SearchBar({ properties, city, onCityChange }: SearchBarProps) {
  const [search, setSearch] = useState("");
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
        className="fixed z-30 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl touch-pan-y"
        role="listbox"
      >
        {filteredResults.length > 0 ? (
          <>
            <div className="sticky top-0 border-b border-slate-100 bg-white px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
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
                className={`cursor-pointer border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 last:border-b-0 ${
                  highlightedIndex === index ? "bg-slate-50" : ""
                }`}
              >
                <p className="font-medium text-slate-900">{property.name}</p>
                <p className="mt-1 text-sm text-slate-500">{property.location}</p>
              </div>
            ))}
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="font-medium text-slate-900">
              No matching properties found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Try a locality, society, apartment, property, or landmark.
            </p>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={searchRef} className="w-full">
      <div className="flex h-[68px] overflow-visible rounded-2xl border border-slate-300 bg-white shadow-[0_16px_35px_-20px_rgba(15,23,42,0.3)] transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        <CitySelector value={city} onChange={onCityChange} />
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
          className="min-w-0 flex-1 bg-transparent px-5 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none"
        />
        <button
          type="button"
          onClick={performSearch}
          aria-label="Search properties"
          className="m-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
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
