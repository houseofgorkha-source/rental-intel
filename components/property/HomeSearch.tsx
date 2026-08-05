"use client";

import CitySelector from "@/components/CitySelector";
import SearchBar from "@/components/SearchBar";
import AreaMultiSelect from "@/components/property/AreaMultiSelect";

type SearchProperty = {
  slug: string;
  name: string;
  location: string;
};

type HomeSearchProps = {
  properties: SearchProperty[];
  city: string;
  onCityChange: (city: string) => void;
  areas: string[];
  selectedAreas: string[];
  onAreasChange: (areas: string[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
};

// The homepage's single search entry point: city, multi-area chips, and
// free-text search combined into one unit — composed from the same three
// pieces that used to be separate toolbar controls (CitySelector,
// AreaSelector's multi-select sibling, and SearchBar's text input), not
// rebuilt from scratch.
export default function HomeSearch({
  properties,
  city,
  onCityChange,
  areas,
  selectedAreas,
  onAreasChange,
  query,
  onQueryChange,
}: HomeSearchProps) {
  return (
    <div className="flex flex-1 flex-wrap items-start gap-2.5">
      <CitySelector value={city} onChange={onCityChange} variant="pill" />
      <AreaMultiSelect areas={areas} value={selectedAreas} onChange={onAreasChange} />
      <div className="min-w-[12rem] flex-1">
        <SearchBar
          properties={properties}
          query={query}
          onQueryChange={onQueryChange}
          showCityPicker={false}
        />
      </div>
    </div>
  );
}
