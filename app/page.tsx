import SearchBar from "../components/SearchBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">

        <h1 className="text-7xl font-extrabold tracking-tight text-gray-900 md:text-8xl">
          RentalIntel
        </h1>

        <p className="mt-4 text-xl font-semibold tracking-wide text-gray-600 md:text-2xl">
          Know it before you rent it.
        </p>

        <div className="mt-12 w-full">
          <SearchBar />
        </div>

        <div className="mt-12 max-w-3xl rounded-2xl border border-gray-200 bg-white p-8">

          <h2 className="text-xl font-semibold text-gray-900">
            Trusted by Design
          </h2>

          <p className="mt-4 leading-8 text-gray-600">
            <span className="font-semibold text-gray-900">
              Every published review comes from a verified tenant who has lived
              there.
            </span>
          </p>

          <p className="mt-4 leading-8 text-gray-600">
            Every review is manually verified by the RentalIntel team before it
            is published, helping renters make informed decisions with greater
            confidence.
          </p>

        </div>

      </section>
    </main>
  );
}