import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { PropertyList } from "@/components/property/PropertyDiscovery";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";

export const dynamic = "force-dynamic";

export default async function Home() {
  const city = DEFAULT_CITY;
  const properties = await getDiscoveryProperties(city);
  const searchProperties = properties.map((property) => ({
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
              <SearchBar properties={searchProperties} />
              {properties.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  No properties are available yet. Try adding the first one.
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
              properties={properties}
              heading={`${city} properties`}
              showToolbar
              compact
              scrollable
              areas={LOCALITIES_BY_CITY[city] ?? []}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
