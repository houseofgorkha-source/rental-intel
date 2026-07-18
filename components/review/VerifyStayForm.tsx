import Link from "next/link";

type VerifyStayFormProps = {
  propertyName: string;
  propertySlug: string;
};

const acceptedDocuments = [
  {
    title: "Rental Agreement",
    description: "A signed agreement that shows your name and the property address.",
  },
  {
    title: "Rent Receipt",
    description: "A recent receipt that confirms your tenancy at this property.",
  },
  {
    title: "Electricity Bill",
    description: "A bill that includes your name and the property address.",
  },
  {
    title: "Other Proof of Stay",
    description: "Another document that reasonably confirms your tenancy.",
  },
];

export default function VerifyStayForm({
  propertyName,
  propertySlug,
}: VerifyStayFormProps) {
  return (
    <main className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">
        <Link
          href={`/property/${propertySlug}/review/success`}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Review Status
        </Link>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Verify Your Stay
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
            Help renters trust your experience.
          </h1>

          <p className="mt-4 text-lg leading-7 text-gray-600">
            Verification shows that you stayed at {propertyName}. It gives your
            review more credibility while keeping every renter&apos;s experience
            valued.
          </p>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="text-2xl font-semibold text-gray-900">
            Accepted documents
          </h2>

          <p className="mt-2 text-gray-600">
            Choose one document that helps us confirm your stay.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {acceptedDocuments.map((document) => (
              <div
                key={document.title}
                className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5"
              >
                <div className="text-3xl" aria-hidden="true">
                  📄
                </div>

                <h3 className="mt-4 font-semibold text-gray-900">
                  {document.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {document.description}
                </p>

                <p className="mt-5 text-sm font-medium text-blue-600">
                  Upload document
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-gray-600">
            If you have another document that reasonably proves your tenancy,
            you may upload it. Our team will review it during verification.
          </p>
        </section>

        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Privacy notice</h2>

          <p className="mt-3 leading-7 text-gray-700">
            Documents are used only to verify your stay and are never displayed publicly.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm uppercase tracking-wider text-gray-500">
            Verification status
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Pending Review</h2>
              <p className="mt-1 text-sm text-gray-600">
                Sample status shown while a submitted document is reviewed.
              </p>
            </div>

            <span className="w-fit rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
              Pending Review
            </span>
          </div>
        </div>

        <button
          type="button"
          className="mt-8 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          Submit for Verification
        </button>
      </div>
    </main>
  );
}
