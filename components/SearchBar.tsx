"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchProperty = {
  slug: string;
  name: string;
  location: string;
};

type SearchBarProps = {
  properties: SearchProperty[];
};

export default function SearchBar({ properties }: SearchBarProps) {
  const [search, setSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const router = useRouter();

  const filteredResults = properties.filter((property) =>
    property.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    resultRefs.current[highlightedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedIndex]);

  const selectProperty = (property: SearchProperty) => {
    router.push(`/property/${property.slug}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (!isDropdownOpen || filteredResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex === filteredResults.length - 1 ? 0 : currentIndex + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex <= 0 ? filteredResults.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectProperty(filteredResults[highlightedIndex]);
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex overflow-hidden rounded-full border border-gray-300 bg-white transition focus-within:border-blue-600">

        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsDropdownOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => search && setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search properties, societies or areas..."
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(search) && isDropdownOpen}
          aria-controls="property-search-results"
          className="flex-1 bg-white px-7 py-4 text-base text-gray-900 placeholder:text-gray-400 outline-none"
        />

        <button className="w-20 border-l border-gray-300 bg-white text-xl transition hover:bg-blue-50">
          🔍
        </button>

      </div>

      {search && isDropdownOpen && (
        <div
          id="property-search-results"
          className="absolute z-20 mt-3 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
        >

          {filteredResults.length > 0 ? (
            <>
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Search Results
              </div>

              {filteredResults.map((property, index) => (
                <div
                  key={property.slug}
                  ref={(element) => {
                    resultRefs.current[index] = element;
                  }}
                  onClick={() => selectProperty(property)}
                  className={`cursor-pointer border-b border-gray-100 px-6 py-4 transition hover:bg-gray-50 last:border-b-0 ${
                    highlightedIndex === index ? "bg-gray-50" : ""
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    {property.name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {property.location}
                  </p>
                </div>
              ))}

              <div
                onClick={() =>
                  router.push(
                    `/add-property?query=${encodeURIComponent(search)}`
                  )
                }
                className="cursor-pointer border-t border-gray-200 bg-gray-50 px-6 py-5 transition hover:bg-blue-50"
              >
                <p className="font-semibold text-blue-600">
                  ➕ Can&apos;t find your property?
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  Add it to RentalIntel and help future tenants.
                </p>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">

              <div className="text-5xl">
                🏠
              </div>

              <h3 className="mt-5 text-2xl font-semibold text-gray-900">
                Can&apos;t find your property?
              </h3>

              <p className="mt-3 text-gray-600">
                Be the first to add it to RentalIntel and help future tenants
                make better rental decisions.
              </p>

              <button
                onClick={() =>
                  router.push(
                    `/add-property?query=${encodeURIComponent(search)}`
                  )
                }
                className="mt-8 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Add This Property
              </button>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
