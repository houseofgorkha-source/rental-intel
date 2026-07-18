import Link from "next/link";

export default function PropertiesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
        <span className="rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
          🚧 Coming Soon
        </span>

        <h1 className="mt-6 text-5xl font-bold text-gray-900">
          Browse Properties
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          Soon you&apos;ll be able to browse verified rental properties, compare
          reviews, and discover trusted homes before you rent.
        </p>

        <div className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8">
          <p className="text-lg font-semibold text-gray-800">
            🏡 🏡 The RentalIntel property directory is coming soon.

Properties, reviews, photos, and rental information will be added and maintained by our community of tenants and verified contributors.
          </p>

          <p className="mt-2 text-gray-600">
            For now, you can explore individual property pages directly.
          </p>
        </div>

        <Link
          href="/"
          className="mt-10 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}   
