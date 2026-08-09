import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import {
  propertyStatusLabel,
  propertyStatusTone,
  verificationStatusLabel,
  verificationStatusTone,
} from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

type AdminReviewRow = {
  id: string;
  title: string;
  body: string;
  overall_rating: number;
  recommendation: "yes" | "maybe" | "no";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  created_at: string;
  is_anonymous: boolean;
  // See lib/embedded.ts — a review's property is a many-to-one embed.
  properties:
    | { slug: string; name: string; status: string }
    | { slug: string; name: string; status: string }[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// Read-only, permanently.
//
// RentalIntel's promise is that it never removes a truthful review under
// pressure (CLAUDE.md §3). A moderation screen that could edit or delete one
// would make that promise a matter of restraint rather than of design, so
// administrators hold no write privilege on `reviews` at all — not here, and
// not in the database. What this page is for is noticing: a review sitting on
// an unpublished property, or one whose stay verification is still waiting on
// a decision.
export default async function AdminReviewsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select(
      "id, title, body, overall_rating, recommendation, verification_status, created_at, is_anonymous, properties!inner(slug, name, status)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const reviews = (data ?? []) as AdminReviewRow[];

  const needsAttention = reviews.filter(
    (review) =>
      one(review.properties)?.status !== "published" ||
      review.verification_status === "pending",
  );

  return (
    <div className="flex flex-col gap-10">
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Reviews can be read here but never edited or removed — RentalIntel
        doesn&apos;t take down a truthful review, so the ability to do it
        doesn&apos;t exist in the product or the database.
      </p>

      <section aria-labelledby="attention">
        <h2 id="attention" className="text-lg font-medium tracking-[-0.02em] text-foreground">
          Needs attention
        </h2>
        <p className="mt-1 text-sm text-muted">
          On a property that isn&apos;t published, or waiting on a verification
          decision.
        </p>

        <div className="mt-4">
          {needsAttention.length === 0 ? (
            <EmptyState
              title="Nothing needs attention."
              description="Every recent review sits on a published property and has no verification request waiting."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {needsAttention.map((review) => (
                <ReviewRow key={review.id} review={review} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="text-lg font-medium tracking-[-0.02em] text-foreground">
          Most recent
        </h2>
        <p className="mt-1 text-sm text-muted">The last {reviews.length} reviews written.</p>

        <div className="mt-4">
          {reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet."
              description="Reviews appear here as soon as someone writes one."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {reviews.map((review) => (
                <ReviewRow key={review.id} review={review} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewRow({ review }: { review: AdminReviewRow }) {
  const property = one(review.properties);

  return (
    <li className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{review.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {review.overall_rating}/5 · {review.is_anonymous ? "anonymous" : "attributed"} ·{" "}
            {formatDate(review.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {property && (
            <StatusPill tone={propertyStatusTone(property.status)}>
              Property: {propertyStatusLabel(property.status).toLowerCase()}
            </StatusPill>
          )}
          {review.verification_status !== "unverified" && (
            <StatusPill tone={verificationStatusTone(review.verification_status)}>
              {verificationStatusLabel(review.verification_status)}
            </StatusPill>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{review.body}</p>

      {property && (
        <Link
          href={`/admin/properties/${property.slug}`}
          className="mt-3 inline-flex text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
        >
          {property.name} →
        </Link>
      )}
    </li>
  );
}
