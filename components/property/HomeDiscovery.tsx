"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SearchBar from "@/components/SearchBar";
import { PropertyList } from "@/components/property/PropertyDiscovery";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type HomeDiscoveryProps = {
  properties: DiscoveryProperty[];
};

// Owns the selected city so the hero's SearchBar/CitySelector and the
// property panel's toolbar/AreaSelector stay in sync — they're siblings in
// the layout below, so this is their nearest common ancestor. `properties`
// is fetched server-side for DEFAULT_CITY only (the one available city
// today); switching to another city filters client-side rather than
// refetching, which is correct since every other city has zero published
// properties until it's rolled out.
export default function HomeDiscovery({ properties }: HomeDiscoveryProps) {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);

  const cityProperties = useMemo(
    () => properties.filter((property) => cityMatches(property.city, selectedCity)),
    [properties, selectedCity],
  );

  const searchProperties = cityProperties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: `${property.area}, ${property.city}`,
  }));

  return (
    <main className="min-h-screen min-w-0 bg-[#fbfbfa]">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2 lg:items-start">
        <section className="min-w-0 px-7 pb-16 pt-28 lg:px-12 xl:px-20">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.6rem,5vw,4.75rem)] font-medium leading-[0.98] tracking-[-0.055em] text-slate-950">
              Know it before you <span className="text-blue-600">rent.</span>
            </h1>

            <p className="mt-6 max-w-[31rem] text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Search properties with genuine tenant experiences before you rent.
            </p>

            <div className="mt-12 max-w-xl">
              <SearchBar
                properties={searchProperties}
                city={selectedCity}
                onCityChange={setSelectedCity}
              />
              {cityProperties.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  {selectedCity === DEFAULT_CITY
                    ? "No properties are available yet. Try adding the first one."
                    : `${selectedCity} is coming soon. Try ${DEFAULT_CITY} for now.`}
                </p>
              )}
            </div>

            <div className="mt-12 max-w-[31rem] border-t border-slate-200 pt-8">
              <p className="text-base font-semibold text-slate-900">
                Be part of the community.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Share your experience about the place you call home today. Help
                future renters make better decisions while building a more
                transparent rental community.
              </p>
              <Link
                href="/add-property"
                className="mt-4 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
              >
                Review Your Current Stay
              </Link>
            </div>
          </div>
        </section>

        <section className="min-w-0 px-7 pt-28 lg:px-12 xl:px-20" aria-label="Property discovery">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#f6f6f4] p-6 lg:p-8">
            <PropertyList
              properties={cityProperties}
              heading={`${selectedCity} properties`}
              showToolbar
              compact
              scrollable
              areas={LOCALITIES_BY_CITY[selectedCity] ?? []}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
