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

// The homepage's single search entry point: City, Area, and free-text
// search rendered as flush segments of ONE thin bar (via SearchBar's
// leadingContent + compact props), not as separate pills beside it. The
// Area segment's own removable chip list lives inside its dropdown, so
// this bar stays a fixed height no matter how many areas are selected.
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
    <div className="min-w-[18rem] flex-1">
      <SearchBar
        properties={properties}
        query={query}
        onQueryChange={onQueryChange}
        showCityPicker={false}
        compact
        leadingContent={
          <>
            <CitySelector value={city} onChange={onCityChange} />
            <AreaMultiSelect
              areas={areas}
              value={selectedAreas}
              onChange={onAreasChange}
              variant="embedded-middle"
            />
          </>
        }
      />
    </div>
  );
}
