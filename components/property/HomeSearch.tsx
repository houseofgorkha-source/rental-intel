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
  // Passed straight through to SearchBar — see its own comment. Undefined by
  // default, so every existing caller keeps today's "navigate to the
  // property page" behavior unchanged.
  onSelectProperty?: (slug: string) => void;
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
  onSelectProperty,
}: HomeSearchProps) {
  return (
    <div className="w-full min-w-0 sm:w-auto sm:min-w-[18rem] sm:flex-1">
      <SearchBar
        properties={properties}
        query={query}
        onQueryChange={onQueryChange}
        onSelectProperty={onSelectProperty}
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
