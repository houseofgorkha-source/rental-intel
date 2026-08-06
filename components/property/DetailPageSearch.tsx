"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import HomeSearch from "@/components/property/HomeSearch";
import {
  FiltersButton,
  RENT_MIN,
  RENT_MAX,
  type OnlyShowFilters,
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
  const [rentRange, setRentRange] = useState<[number, number]>([RENT_MIN, RENT_MAX]);
  const [onlyShow, setOnlyShow] = useState<OnlyShowFilters>({
    reviewsOnly: false,
    photosOnly: false,
  });

  function handleCityChange(nextCity: string) {
    setCity(nextCity);
    setSelectedAreas([]);
  }

  function handleSearch() {
    const params = new URLSearchParams();
    if (city !== DEFAULT_CITY) params.set("city", city);
    if (selectedAreas.length > 0) params.set("areas", selectedAreas.join(","));
    if (query.trim()) params.set("q", query.trim());
    if (rentRange[0] !== RENT_MIN) params.set("rentMin", String(rentRange[0]));
    if (rentRange[1] !== RENT_MAX) params.set("rentMax", String(rentRange[1]));
    if (onlyShow.reviewsOnly) params.set("reviewsOnly", "1");
    if (onlyShow.photosOnly) params.set("photosOnly", "1");

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
      <FiltersButton
        rentRange={rentRange}
        onRentRangeChange={setRentRange}
        onlyShow={onlyShow}
        onOnlyShowChange={setOnlyShow}
      />
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
