import SearchBar from "../components/SearchBar";
export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">

        {/* Brand */}
        <h1 className="text-7xl font-extrabold tracking-tight text-[#1B4332] md:text-8xl">
          RentalIntel
        </h1>

        {/* Tagline */}
        <p className="mt-4 text-2xl font-extrabold uppercase tracking-wide">
          <span className="text-pink-500">Know</span>{" "}
          <span className="text-purple-500">it</span>{" "}
          <span className="text-sky-500">before</span>{" "}
          <span className="text-green-500">you</span>{" "}
          <span className="text-yellow-500">rent</span>{" "}
          <span className="text-pink-500">it.</span>
        </p>
        {/* Search */}
       <SearchBar />

        {/* Trust Statement */}

        <p className="mt-8 max-w-3xl text-base leading-8 text-gray-600">
          <span className="font-semibold text-[#1B4332]">
            Every published review comes from a verified tenant who has lived there.
          </span>{" "}
            <br />
            <br />
          Every review is verified by the RentalIntel team before it is published,
          helping you make informed rental decisions with confidence.
        </p>

      </section>
    </main>
  );
}