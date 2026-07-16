import SearchBar from "../components/SearchBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">

        {/* Brand */}

        <div className="text-5xl">🏠</div>

        <h1 className="mt-5 text-6xl font-extrabold tracking-tight text-gray-900 md:text-7xl">
          RentalIntel
        </h1>

        {/* Tagline */}

        <p className="mt-5 text-xl font-normal text-gray-600 md:text-2xl">
          Know it before you rent it.
        </p>

        {/* Search */}

        <div className="mt-10 w-full max-w-4xl">
          <SearchBar />
        </div>

        {/* Trust Statement */}

        <div className="mt-10 max-w-2xl">

          <p className="text-lg font-semibold text-gray-900">
            Real experiences from verified tenants.
          </p>

          <p className="mt-3 text-base leading-7 text-gray-600">
            Discover what previous tenants wish they had known before renting,
            helping you make smarter rental decisions with confidence.
          </p>

        </div>

      </section>
    </main>
  );
}