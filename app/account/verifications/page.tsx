import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import {
  verificationStatusLabel,
  verificationStatusTone,
} from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

type EmbeddedProperty = { slug: string; name: string };
type EmbeddedReview = { id: string; properties: EmbeddedProperty | EmbeddedProperty[] };

type VerificationRow = {
  id: string;
  status: "pending" | "verified" | "rejected";
  submitted_at: string;
  rejection_reason: string | null;
  reviews: EmbeddedReview | EmbeddedReview[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AccountVerificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/verifications");

  // No new RLS needed: "Users can read their own verification requests"
  // already scopes this to created_by = auth.uid().
  const { data } = await supabase
    .from("review_verifications")
    .select("id, status, submitted_at, rejection_reason, reviews!inner(id, properties!inner(slug, name))")
    .eq("created_by", user.id)
    .order("submitted_at", { ascending: false });

  const verifications = (data ?? []) as VerificationRow[];

  if (verifications.length === 0) {
    return (
      <EmptyState
        title="No verification requests yet."
        description="Verification is submitted from a property you've reviewed. It links documents to your review so renters can see you genuinely lived there."
        actionHref="/account/reviews"
        actionLabel="See my reviews →"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {verifications.map((verification) => {
        const review = one(verification.reviews);
        const property = one(review?.properties);

        return (
          <li
            key={verification.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="truncate text-base font-medium text-slate-950">
                {property?.name ?? "Property"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Submitted {formatDate(verification.submitted_at)}
              </p>
              <div className="mt-2.5">
                <StatusPill tone={verificationStatusTone(verification.status)}>
                  {verificationStatusLabel(verification.status)}
                </StatusPill>
              </div>
              {verification.rejection_reason && (
                <p className="mt-2 text-sm text-slate-600">
                  {verification.rejection_reason}
                </p>
              )}
            </div>

            {property && (
              <Link
                href={`/property/${property.slug}`}
                className="shrink-0 text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
              >
                View property
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
