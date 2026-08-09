"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import HomeSearch from "@/components/property/HomeSearch";
import {
  FiltersButton,
  DEFAULT_FILTERS,
  RENT_MIN,
  RENT_MAX,
  type PropertyFilters,
} from "@/components/property/PropertyDiscovery";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";

type SearchProperty = {
  slug: string;
  name: string;
  location: string;
};

type DetailPageSearchProps = {
  properties: SearchProperty[];
};

// Reuses the exact same search/filter components as the homepage (HomeSearch,
// FiltersButton) — no second search or filter implementation. Unlike the
// homepage, this widget never filters anything in place: it exists purely to
// hand a search off to /property, the single canonical results page (see
// PropertyDiscovery.tsx + app/property/page.tsx's searchParams seeding).
export default function DetailPageSearch({ properties }: DetailPageSearchProps) {
  const router = useRouter();
  const [city, setCity] = useState(DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);

  function handleCityChange(nextCity: string) {
    setCity(nextCity);
    setSelectedAreas([]);
  }

  // Every filter the panel can set is carried into the URL. Anything omitted
  // here would be silently discarded on the way to /property — the same class
  // of dead control this change is fixing inside the panel itself.
  function handleSearch() {
    const params = new URLSearchParams();
    if (city !== DEFAULT_CITY) params.set("city", city);
    if (selectedAreas.length > 0) params.set("areas", selectedAreas.join(","));
    if (query.trim()) params.set("q", query.trim());
    if (filters.rentRange[0] !== RENT_MIN) params.set("rentMin", String(filters.rentRange[0]));
    if (filters.rentRange[1] !== RENT_MAX) params.set("rentMax", String(filters.rentRange[1]));
    if (filters.depositRange[0] !== DEFAULT_FILTERS.depositRange[0]) {
      params.set("depositMin", String(filters.depositRange[0]));
    }
    if (filters.depositRange[1] !== DEFAULT_FILTERS.depositRange[1]) {
      params.set("depositMax", String(filters.depositRange[1]));
    }
    if (filters.configurations.length > 0) params.set("config", filters.configurations.join(","));
    if (filters.propertyTypes.length > 0) params.set("ptype", filters.propertyTypes.join(","));
    if (filters.furnishing.length > 0) params.set("furnishing", filters.furnishing.join(","));
    if (filters.minAreaSqft !== null) params.set("minArea", String(filters.minAreaSqft));
    if (filters.listedWithinDays !== null) {
      params.set("listedWithin", String(filters.listedWithinDays));
    }
    if (filters.postedBy.length > 0) params.set("postedBy", filters.postedBy.join(","));
    if (filters.onlyShow.reviewsOnly) params.set("reviewsOnly", "1");
    if (filters.onlyShow.photosOnly) params.set("photosOnly", "1");

    const queryString = params.toString();
    router.push(queryString ? `/property?${queryString}` : "/property");
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <HomeSearch
        properties={properties}
        city={city}
        onCityChange={handleCityChange}
        areas={LOCALITIES_BY_CITY[city] ?? []}
        selectedAreas={selectedAreas}
        onAreasChange={setSelectedAreas}
        query={query}
        onQueryChange={setQuery}
      />
      <FiltersButton filters={filters} onFiltersChange={setFilters} />
      <button
        type="button"
        onClick={handleSearch}
        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Search
      </button>
    </div>
  );
}
