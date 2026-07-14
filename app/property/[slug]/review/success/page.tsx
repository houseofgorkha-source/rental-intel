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

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-6">

      <div className="max-w-2xl rounded-3xl bg-white p-10 shadow-xl text-center">

        <div className="text-8xl animate-bounce">
    🏠💚
</div>

        <h1 className="mt-6 text-4xl font-bold text-gray-900">
  You just helped the next renter.
</h1>

<p className="mt-5 text-xl font-semibold text-[#1B4332]">
  {slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")}
</p>

<p className="mt-4 text-lg text-gray-600">
  Your experience is now helping future tenants make smarter rental decisions.
</p>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6">

          <h2 className="text-xl font-semibold text-gray-900">
  Review Status
</h2>

<div className="mt-5 space-y-3 text-left">

  <div className="flex items-center gap-3">
    <span className="text-2xl">🟢</span>
    <div>
      <p className="font-semibold text-gray-900">
        Public
      </p>
      <p className="text-sm text-gray-600">
        Your review has been submitted and is now publicly visible.
      </p>
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
          Your experience is now visible to the community.
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
          Upload your rental agreement or supporting documents.
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
          Write helpful reviews appreciated by the community.
        </p>
      </div>
    </div>

  </div>

</div>
  <div className="flex items-center gap-3">
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

<div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-5 text-left">

  <h3 className="text-lg font-semibold text-[#1B4332]">
    Earn a Verification Badge
  </h3>

  <p className="mt-3 text-gray-700">
    Upload your rental agreement or supporting documents anytime to earn a
    <strong> Verified Tenant</strong> or
    <strong> Verified Occupancy</strong> badge.
  </p>

  <p className="mt-4 text-sm text-gray-600">
    Verified reviews help renters make more confident decisions while keeping
    RentalIntel transparent and trustworthy.
  </p>

</div>

        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">

  <Link
    href={`/property/${slug}`}
    className="flex items-center justify-center rounded-xl bg-[#1B4332] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#2D6A4F]"
  >
    ← Return to Property
  </Link>

  <button
    disabled
    className="flex items-center justify-center rounded-xl border-2 border-[#1B4332] bg-white px-8 py-4 text-lg font-semibold text-[#1B4332] opacity-60"
  >
    🛡 Verify My Review
    <span className="ml-2 text-sm">(Coming Soon)</span>
  </button>

</div>

      </div>

    </main>
  );
}