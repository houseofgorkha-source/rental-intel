"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createVerification } from "@/app/actions/verification";

// Keys match app/actions/verification.ts's `documentFields` and the
// verification_document_type enum exactly. Declared rather than derived from
// the title so a copy edit can never silently break the form field names.
type DocumentType =
  | "rental_agreement"
  | "rent_receipt"
  | "electricity_bill"
  | "other_proof_of_stay";

type VerifyStayFormProps = {
  propertyName: string;
  propertySlug: string;
  reviewId: string;
  isSubmitted: boolean;
  verificationStatus: "pending" | "verified" | "rejected" | null;
  submittedTypes: string[];
};

const acceptedDocuments: {
  type: DocumentType;
  title: string;
  description: string;
}[] = [
  {
    type: "rental_agreement",
    title: "Rental Agreement",
    description: "A signed agreement that shows your name and the property address.",
  },
  {
    type: "rent_receipt",
    title: "Rent Receipt",
    description: "A recent receipt that confirms your tenancy at this property.",
  },
  {
    type: "electricity_bill",
    title: "Electricity Bill",
    description: "A bill that includes your name and the property address.",
  },
  {
    type: "other_proof_of_stay",
    title: "Other Proof of Stay",
    description: "Another document that reasonably confirms your tenancy.",
  },
];

// Mirrors app/actions/verification.ts. The server remains the authority —
// these exist so a user learns about an oversized or wrong-typed file
// immediately instead of after a failed upload round-trip.
const maxFileSize = 5 * 1024 * 1024;
const maxTotalSize = 15 * 1024 * 1024;
const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VerifyStayForm({
  propertyName,
  propertySlug,
  reviewId,
  isSubmitted,
  verificationStatus,
  submittedTypes,
}: VerifyStayFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Per-document-type selection. The previous version had a single boolean
  // for all four cards, which is why every card claimed to be submitted once
  // any one of them was, and why choosing a file changed nothing on screen.
  const [selected, setSelected] = useState<Partial<Record<DocumentType, File>>>({});
  const inputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});
  const router = useRouter();

  const submitted = new Set(submittedTypes);
  const selectedEntries = Object.entries(selected) as [DocumentType, File][];
  const selectedCount = selectedEntries.length;
  const canSubmit = !isSubmitted && selectedCount > 0 && !isSubmitting;

  function handleFileChange(type: DocumentType, file: File | undefined) {
    setError(null);

    if (!file) {
      setSelected((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      return;
    }

    if (!allowedTypes.includes(file.type) || file.size > maxFileSize) {
      setError("Documents must be PDF, JPG, or PNG files up to 5 MB.");
      if (inputRefs.current[type]) inputRefs.current[type]!.value = "";
      return;
    }

    const totalSize =
      selectedEntries
        .filter(([key]) => key !== type)
        .reduce((total, [, existing]) => total + existing.size, 0) + file.size;

    if (totalSize > maxTotalSize) {
      setError("Total document upload size must be 15 MB or less.");
      if (inputRefs.current[type]) inputRefs.current[type]!.value = "";
      return;
    }

    setSelected((current) => ({ ...current, [type]: file }));
  }

  // Clears the underlying input too: the file inputs are uncontrolled, so
  // resetting state alone would leave the file attached to the form and it
  // would still be submitted.
  function handleRemove(type: DocumentType) {
    if (inputRefs.current[type]) inputRefs.current[type]!.value = "";
    handleFileChange(type, undefined);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    const result = await createVerification(new FormData(event.currentTarget));

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push(`/property/${propertySlug}?verification=submitted`);
  };

  const statusHeading = isSubmitted
    ? verificationStatus === "verified"
      ? "Verified"
      : verificationStatus === "rejected"
        ? "Not verified"
        : "Pending review"
    : selectedCount > 0
      ? `${selectedCount} document${selectedCount === 1 ? "" : "s"} ready to submit`
      : "Not submitted";

  const statusDetail = isSubmitted
    ? verificationStatus === "verified"
      ? "Your stay at this property has been verified."
      : verificationStatus === "rejected"
        ? "We couldn't verify your stay from the documents provided."
        : "Your documents are awaiting review."
    : selectedCount > 0
      ? "Submit when you're ready. Nothing is uploaded until you do."
      : "Choose a document to start verification.";

  const statusTone = isSubmitted
    ? verificationStatus === "verified"
      ? "bg-emerald-100 text-emerald-800"
      : verificationStatus === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700"
    : selectedCount > 0
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-600";

  return (
    <main className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">
        <Link
          href={`/property/${propertySlug}/review/success?reviewId=${reviewId}`}
          className="inline-flex items-center rounded-lg px-1 py-0.5 text-sm font-medium text-blue-600 transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
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

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="reviewId" value={reviewId} />

          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="text-2xl font-semibold text-gray-900">
              Accepted documents
            </h2>

            <p className="mt-2 text-gray-600">
              {isSubmitted
                ? "These are the document types we accept. Your submission is shown below."
                : "Choose one document that helps us confirm your stay."}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {acceptedDocuments.map((document) => {
                const isDocumentSubmitted = submitted.has(document.type);
                const selectedFile = selected[document.type];

                return (
                  <div
                    key={document.type}
                    className={`flex flex-col rounded-2xl border p-5 ${
                      isDocumentSubmitted
                        ? "border-solid border-emerald-200 bg-emerald-50"
                        : selectedFile
                          ? "border-solid border-blue-200 bg-blue-50"
                          : "border-dashed border-gray-300 bg-gray-50"
                    }`}
                  >
                    <div className="text-3xl" aria-hidden="true">
                      {isDocumentSubmitted ? "✅" : selectedFile ? "📎" : "📄"}
                    </div>

                    <h3 className="mt-4 font-semibold text-gray-900">
                      {document.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {document.description}
                    </p>

                    <div className="mt-5">
                      {isDocumentSubmitted ? (
                        <p className="text-sm font-medium text-emerald-700">
                          Submitted
                        </p>
                      ) : isSubmitted ? (
                        <p className="text-sm text-gray-500">Not submitted</p>
                      ) : (
                        // The file input stays mounted whether or not a file
                        // has been chosen. It is uncontrolled — the file lives
                        // on the DOM node, not in React state — so rendering
                        // the chosen-file summary *instead of* the input
                        // unmounted it and dropped the file from the form:
                        // the page said "1 document ready to submit" while the
                        // request carried none, and every submission failed
                        // with "Please choose at least one supporting
                        // document." The summary is now rendered alongside the
                        // input, never in place of it.
                        <div>
                          {selectedFile && (
                            <>
                              <p className="break-all text-sm font-medium text-blue-700">
                                {selectedFile.name}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-600">
                                {formatFileSize(selectedFile.size)} · ready to submit
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemove(document.type)}
                                className="mt-2 mr-4 rounded-lg px-1 py-0.5 text-sm font-medium text-gray-600 underline underline-offset-4 transition hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                              >
                                Remove
                              </button>
                            </>
                          )}
                          <label
                            className={`cursor-pointer text-sm font-medium text-blue-600 focus-within:underline hover:underline ${
                              selectedFile ? "inline-block" : "block"
                            }`}
                          >
                            {selectedFile ? "Replace file" : "Choose file"}
                            <input
                              ref={(element) => {
                                inputRefs.current[document.type] = element;
                              }}
                              className="sr-only"
                              type="file"
                              name={document.type}
                              accept="application/pdf,image/jpeg,image/png"
                              onChange={(event) =>
                                handleFileChange(document.type, event.target.files?.[0])
                              }
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-sm leading-6 text-gray-600">
              PDF, JPG or PNG, up to 5 MB each. If you have another document
              that reasonably proves your tenancy, you may upload it — our team
              will review it during verification.
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

            {/* Announces selection and submission progress to screen readers,
                which would otherwise get no feedback from a click that
                uploads for several seconds. */}
            <div
              role="status"
              aria-live="polite"
              className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isSubmitting ? "Submitting..." : statusHeading}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {isSubmitting
                    ? "Uploading your documents. Please don't close this page."
                    : statusDetail}
                </p>
              </div>

              <span
                className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${statusTone}`}
              >
                {isSubmitting ? "Submitting..." : statusHeading}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="mt-8 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
          >
            {isSubmitted
              ? "Verification Submitted"
              : isSubmitting
                ? "Submitting..."
                : selectedCount === 0
                  ? "Choose a document to continue"
                  : `Submit ${selectedCount} document${selectedCount === 1 ? "" : "s"} for verification`}
          </button>
        </form>
      </div>
    </main>
  );
}
