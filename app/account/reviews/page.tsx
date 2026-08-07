import Link from "next/link";
import { redirect } from "next/navigation";
import ReviewCard, { type Review } from "@/components/property/ReviewCard";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState } from "@/components/shared/StatusPrimitives";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  title: string;
  body: string;
  overall_rating: number;
  recommendation: "yes" | "maybe" | "no";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  created_at: string;
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
      "id, title, body, overall_rating, recommendation, verification_status, created_at, properties!inner(slug, name)",
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ReviewRow[];

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
          date: row.created_at,
          wouldRecommend: row.recommendation === "yes",
        };

        return (
          <li key={row.id}>
            {property && (
              <Link
                href={`/property/${property.slug}`}
                className="mb-2 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
              >
                {property.name} →
              </Link>
            )}
            <ReviewCard review={review} />
          </li>
        );
      })}
    </ul>
  );
}
