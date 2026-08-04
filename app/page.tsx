import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { PropertyList } from "@/components/property/PropertyDiscovery";
import { getDiscoveryProperties } from "@/lib/property-discovery";

export const dynamic = "force-dynamic";

export default async function Home() {
  const properties = await getDiscoveryProperties();
  const searchProperties = properties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: `${property.area}, ${property.city}`,
  }));

  return (
    <main className="min-h-screen min-w-0 bg-[#fbfbfa]">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2">
        <section className="min-w-0 px-7 pb-16 pt-28 lg:px-12 xl:px-20">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.6rem,5vw,4.75rem)] font-medium leading-[0.98] tracking-[-0.055em] text-slate-950">
              Know it before you <span className="text-blue-600">rent.</span>
            </h1>

            <p className="mt-6 max-w-[31rem] text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Search properties to discover genuine tenant experiences before you rent.
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
              <p className="text-sm font-medium text-slate-900">
                Already staying there?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add your property and share your experience. Help future renters
                make better decisions and build a stronger rental community.
              </p>
              <Link
                href="/add-property"
                className="mt-4 inline-flex text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
              >
                Add Property
              </Link>
            </div>
          </div>
        </section>

        <section className="min-w-0 border-t border-slate-200 px-6 py-12 lg:border-l lg:border-t-0 lg:px-9 lg:py-28 xl:px-12" aria-label="Property discovery">
          <div className="mx-auto max-w-5xl">
            <PropertyList
              properties={properties}
              heading="Bangalore properties"
              showToolbar
              compact
              scrollable
            />
          </div>
        </section>
      </div>
    </main>
  );
}
