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
// leadingContent + compact props), not as separate pills beside it.
// Selected areas appear as removable chips below the whole bar.
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

      {selectedAreas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedAreas.map((area) => (
            <span
              key={area}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-2 text-xs font-medium text-slate-700"
            >
              {area}
              <button
                type="button"
                onClick={() => onAreasChange(selectedAreas.filter((item) => item !== area))}
                aria-label={`Remove ${area}`}
                className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
