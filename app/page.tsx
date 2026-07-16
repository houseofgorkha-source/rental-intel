import SearchBar from "../components/SearchBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">

        {/* Brand */}
        <h1 className="text-7xl font-extrabold tracking-tight text-gray-900 md:text-8xl">
          RentalIntel
        </h1>

        {/* Tagline */}
        <p className="mt-5 text-xl font-medium text-gray-600 md:text-2xl">
          Know it before you rent it.
        </p>

        {/* Search */}
        <div className="mt-12 w-full">
          <SearchBar />
        </div>

        {/* Trust Statement */}
        <div className="mt-12 max-w-3xl">
          <p className="text-base leading-8 text-gray-600">
            <span className="font-semibold text-gray-900">
              Every published review comes from a verified tenant who has lived there.
            </span>
          </p>

          <p className="mt-5 text-base leading-8 text-gray-600">
            Every review is manually verified by the RentalIntel team before it
            is published, helping you make informed rental decisions with
            confidence.
          </p>
        </div>

      </section>
    </main>
  );
}
