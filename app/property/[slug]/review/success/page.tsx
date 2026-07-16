import Link from "next/link";

type SuccessPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function SuccessPage({
  params,
}: SuccessPageProps) {
  const { slug } = await params;

  const propertyName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-10 text-center">

        <div className="text-7xl">
          🏠✨
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900">
          You just helped the next renter.
        </h1>

        <p className="mt-5 text-xl font-semibold text-gray-900">
          {propertyName}
        </p>

        <p className="mt-4 text-gray-600">
          Your experience has been submitted and will help future tenants make
          smarter rental decisions.
        </p>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6">

          <h2 className="text-xl font-semibold text-gray-900">
            Review Status
          </h2>

          <div className="mt-6 space-y-5 text-left">

            <div className="flex items-center gap-4">
              <span className="text-2xl">✅</span>

              <div>
                <p className="font-semibold text-gray-900">
                  Review Published
                </p>

                <p className="text-sm text-gray-600">
                  Your review is now visible to the RentalIntel community.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⚪</span>

              <div>
                <p className="font-semibold text-gray-900">
                  Unverified
                </p>

                <p className="text-sm text-gray-600">
                  Verification increases credibility, not the right to be heard.
                </p>
              </div>
            </div>

          </div>

        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left">

          <h2 className="text-xl font-semibold text-gray-900">
            Your Review Journey
          </h2>

          <div className="mt-6 space-y-5">

            <div className="flex items-center gap-4">
              <span className="text-2xl">✅</span>

              <div>
                <p className="font-semibold text-gray-900">
                  Review Published
                </p>

                <p className="text-sm text-gray-600">
                  Your experience is helping future renters today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⬜</span>

              <div>
                <p className="font-semibold text-gray-900">
                  Become a Verified Tenant
                </p>

                <p className="text-sm text-gray-600">
                  Upload supporting documents when verification launches.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⬜</span>

              <div>
                <p className="font-semibold text-gray-900">
                  Earn Trusted Contributor
                </p>

                <p className="text-sm text-gray-600">
                  Continue writing useful reviews for the community.
                </p>
              </div>
            </div>

          </div>

        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">

          <h3 className="text-lg font-semibold text-gray-900">
            Earn a Verification Badge
          </h3>

          <p className="mt-3 text-gray-700">
            Upload your rental agreement or supporting documents in a future
            update to earn a <strong>Verified Tenant</strong> or{" "}
            <strong>Verified Occupancy</strong> badge.
          </p>

          <p className="mt-4 text-sm text-gray-600">
            Verified reviews help renters make informed decisions while keeping
            RentalIntel trustworthy.
          </p>

        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">

          <Link
            href={`/property/${slug}`}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            ← Return to Property
          </Link>

          <button
            disabled
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-4 text-sm font-medium text-gray-500"
          >
            🛡 Verify My Review
            <span className="ml-2 text-xs">
              (Coming Soon)
            </span>
          </button>

        </div>

      </div>
    </main>
  );
}