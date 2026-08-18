import Link from "next/link";
import { redirect } from "next/navigation";
import ReviewCard, { type Review } from "@/components/property/ReviewCard";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState } from "@/components/shared/StatusPrimitives";
import { formatVerifiedVia } from "@/lib/verification";
import { calculateDepositOutcomeScore } from "@/lib/property-format";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  title: string;
  body: string;
  overall_rating: number;
  recommendation: "yes" | "maybe" | "no";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  created_at: string;
  amenities: string[];
  deposit_taken: boolean | null;
  deposit_returned: boolean | null;
  deposit_returned_on_time: boolean | null;
  deposit_additional_deductions: boolean | null;
  deposit_deduction_reason: string | null;
  deposit_deduction_amount: number | null;
  properties: { slug: string; name: string } | { slug: string; name: string }[];
};

export default async function AccountReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/reviews");

  // No new RLS needed: the reviews SELECT policy already allows
  // `or author_id = auth.uid()`.
  const { data } = await supabase
    .from("reviews")
    .select(
      "id, title, body, overall_rating, recommendation, verification_status, created_at, amenities, deposit_taken, deposit_returned, deposit_returned_on_time, deposit_additional_deductions, deposit_deduction_reason, deposit_deduction_amount, properties!inner(slug, name)",
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ReviewRow[];

  // Same disclosure the property page shows on a "Verified Tenant" badge —
  // see review_verified_document_types' own comment (20260817000000) for why
  // this reads from the view rather than verification_documents directly.
  const verifiedDocumentTypesByReview = new Map<string, string[]>();
  if (rows.length > 0) {
    const { data: verifiedDocRows } = await supabase
      .from("review_verified_document_types")
      .select("review_id, document_types")
      .in("review_id", rows.map((row) => row.id));
    (verifiedDocRows ?? []).forEach((row) => {
      verifiedDocumentTypesByReview.set(row.review_id, row.document_types ?? []);
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="You haven't written a review yet."
        description="Reviews are written from a property's page. Find a place you've lived in and share what it was actually like."
        actionHref="/property"
        actionLabel="Find a property →"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const property = one(row.properties);
        // Reuses the exact card the property page renders — the author's own
        // display name is irrelevant here, so it's labelled as theirs.
        const review: Review = {
          id: row.id,
          reviewer: "You",
          rating: row.overall_rating,
          title: row.title,
          review: row.body,
          stay: new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(row.created_at)),
          verified: row.verification_status === "verified",
          verifiedVia: formatVerifiedVia(
            verifiedDocumentTypesByReview.get(row.id) ?? [],
          ),
          date: row.created_at,
          wouldRecommend: row.recommendation === "yes",
          amenities: row.amenities,
          depositScore:
            row.deposit_taken === true
              ? calculateDepositOutcomeScore({
                  depositReturned: row.deposit_returned,
                  depositReturnedOnTime: row.deposit_returned_on_time,
                  depositAdditionalDeductions: row.deposit_additional_deductions,
                })
              : null,
          depositAdditionalDeductions: row.deposit_additional_deductions,
          depositDeductionReason: row.deposit_deduction_reason,
          depositDeductionAmount: row.deposit_deduction_amount,
        };

        if (!property) {
          return (
            <li key={row.id}>
              <ReviewCard review={review} />
            </li>
          );
        }

        return (
          <li key={row.id}>
            <Link
              href={`/property/${property.slug}`}
              className="block rounded-2xl border border-transparent transition-all duration-200 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)]"
            >
              <p className="mb-2 text-sm font-medium text-accent">{property.name} →</p>
              <ReviewCard review={review} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
