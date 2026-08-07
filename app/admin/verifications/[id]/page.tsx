import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { StatusPill } from "@/components/shared/StatusPrimitives";
import {
  verificationStatusLabel,
  verificationStatusTone,
} from "@/components/account/AccountPrimitives";
import VerificationModerationActions from "@/components/admin/VerificationModerationActions";

export const dynamic = "force-dynamic";

const documentLabels: Record<string, string> = {
  rental_agreement: "Rental agreement",
  rent_receipt: "Rent receipt",
  electricity_bill: "Electricity bill",
  other_proof_of_stay: "Other proof of stay",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: verification } = await supabase
    .from("review_verifications")
    .select(
      "id, status, submitted_at, reviewed_at, rejection_reason, created_by, reviews!inner(id, title, body, overall_rating, stay_start_date, stay_end_date, properties!inner(slug, name, area, city))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!verification) notFound();

  // See lib/embedded.ts — these are many-to-one embeds, returned as objects.
  const review = one(verification.reviews);
  const property = one(review?.properties);

  const [{ data: documents }, { data: contributor }] = await Promise.all([
    supabase
      .from("verification_documents")
      .select("id, document_type, storage_path, created_at")
      .eq("verification_id", verification.id)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", verification.created_by)
      .maybeSingle(),
  ]);

  // The bucket is private and its default policies are scoped to the
  // uploader's own folder, so these links only resolve because of the
  // "Administrators can read verification files" storage policy. Signed for
  // ten minutes: long enough to read a lease, short enough that a copied URL
  // stops working — evidence of where someone lived should not be one leaked
  // link away from being permanent.
  const signedDocuments = await Promise.all(
    (documents ?? []).map(async (document) => {
      const { data } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(document.storage_path, 600);

      return {
        id: document.id,
        label: documentLabels[document.document_type] ?? document.document_type,
        url: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/verifications"
          className="rounded-lg px-1 py-0.5 text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          ← Back to verifications
        </Link>
        <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] text-slate-950">
          {property?.name ?? "Property"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {property?.area}, {property?.city} · submitted by{" "}
          <span className="font-medium text-slate-900">
            {contributor?.display_name ?? "a contributor"}
          </span>{" "}
          on {formatDateTime(verification.submitted_at)}
        </p>
        <div className="mt-3">
          <StatusPill tone={verificationStatusTone(verification.status)}>
            {verificationStatusLabel(verification.status)}
          </StatusPill>
        </div>
      </div>

      <section
        aria-labelledby="evidence"
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 id="evidence" className="text-base font-medium text-slate-950">
          Documents
        </h3>
        <p className="mt-1.5 text-sm text-slate-500">
          Does the document show this person at this address? Links expire after
          ten minutes.
        </p>

        {signedDocuments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No documents are attached to this request.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {signedDocuments.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-900">{document.label}</span>
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
                  >
                    Open document ↗
                  </a>
                ) : (
                  <span className="text-sm text-red-600">
                    This file could not be opened.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="decision"
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 id="decision" className="text-base font-medium text-slate-950">
          Decision
        </h3>
        {verification.rejection_reason && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Reason sent to the contributor: {verification.rejection_reason}
          </p>
        )}
        <div className="mt-4">
          <VerificationModerationActions id={verification.id} status={verification.status} />
        </div>
      </section>

      {/* The review is shown read-only and deliberately has no controls. A
          moderator decides whether the stay was proven — never what the
          review is allowed to say. */}
      <section
        aria-labelledby="linked-review"
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 id="linked-review" className="text-base font-medium text-slate-950">
          The review this verifies
        </h3>
        <p className="mt-3 text-sm font-medium text-slate-900">{review?.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          {review?.overall_rating}/5 · stay{" "}
          {review?.stay_start_date ?? "not given"} to {review?.stay_end_date ?? "present"}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review?.body}</p>
        {property && (
          <Link
            href={`/property/${property.slug}`}
            className="mt-4 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
          >
            See the property page →
          </Link>
        )}
      </section>
    </div>
  );
}
