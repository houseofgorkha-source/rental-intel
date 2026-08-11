"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HomeSearch from "@/components/property/HomeSearch";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type ReviewPropertyFinderProps = {
  properties: DiscoveryProperty[];
};

// "Review Your Current Rental Property", end to end: search first, then go
// straight to the matched property's review form, or straight to Add
// Property if it isn't listed yet. Reuses HomeSearch/SearchBar's own
// autocomplete as the ONLY result list (§20 — no second one built alongside
// it); only where picking a result goes is different here, via SearchBar's
// onSelectProperty override.
export default function ReviewPropertyFinder({ properties }: ReviewPropertyFinderProps) {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const searchProperties = useMemo(
    () =>
      properties.map((property) => ({
        slug: property.slug,
        name: property.name,
        location: `${property.area}, ${property.city}`,
      })),
    [properties],
  );

  return (
    <div className="mx-auto max-w-2xl px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Review your rental property
        </h1>
        <p className="mt-3 text-muted">
          Find the property you live in (or lived in) below, and we&apos;ll take
          you straight to its review form.
        </p>
      </div>

      <div className="mt-10">
        <HomeSearch
          properties={searchProperties}
          city={city}
          onCityChange={setCity}
          areas={LOCALITIES_BY_CITY[city] ?? []}
          selectedAreas={selectedAreas}
          onAreasChange={setSelectedAreas}
          query={query}
          onQueryChange={setQuery}
          onSelectProperty={(slug) => router.push(`/property/${slug}/review`)}
        />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Can&apos;t find your property?{" "}
        <Link
          href="/add-property?as=tenant&intent=review"
          className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
        >
          Add it
        </Link>{" "}
        and we&apos;ll take you straight to the review form once it&apos;s submitted.
      </p>
    </div>
  );
}
