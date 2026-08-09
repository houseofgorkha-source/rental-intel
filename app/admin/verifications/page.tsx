import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import {
  verificationStatusLabel,
  verificationStatusTone,
} from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

// See lib/embedded.ts: PostgREST returns a many-to-one embed as an object.
type EmbeddedProperty = { name: string; area: string };
type EmbeddedReview = { title: string; properties: EmbeddedProperty | EmbeddedProperty[] };

type VerificationRow = {
  id: string;
  status: "pending" | "verified" | "rejected";
  submitted_at: string;
  reviews: EmbeddedReview | EmbeddedReview[];
};

const filters = [
  { value: "pending", label: "Awaiting a decision" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Not verified" },
  { value: "all", label: "All" },
] as const;

type FilterValue = (typeof filters)[number]["value"];

function isFilterValue(value: string | undefined): value is FilterValue {
  return filters.some((filter) => filter.value === value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter: FilterValue = isFilterValue(status) ? status : "pending";

  const supabase = await createClient();

  let query = supabase
    .from("review_verifications")
    .select("id, status, submitted_at, reviews!inner(title, properties!inner(name, area))");

  if (activeFilter !== "all") query = query.eq("status", activeFilter);

  const { data } = await query.order("submitted_at", {
    ascending: activeFilter === "pending",
  });

  const verifications = (data ?? []) as VerificationRow[];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter.value === activeFilter;
          return (
            <Link
              key={filter.value}
              href={`/admin/verifications?status=${filter.value}`}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-accent bg-accent text-white"
                  : "border-border-subtle bg-surface text-muted hover:border-muted hover:text-foreground"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {verifications.length === 0 ? (
        <EmptyState
          title="Nothing here right now."
          description="A verification request appears when someone who has written a review uploads proof that they stayed there."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {verifications.map((verification) => {
            const review = one(verification.reviews);
            const property = one(review?.properties);

            return (
              <li key={verification.id}>
                <Link
                  href={`/admin/verifications/${verification.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 transition hover:border-accent hover:shadow-[0_18px_45px_-30px_rgba(255, 90, 54,0.45)] focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {property?.name ?? "Property"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {property?.area} · “{review?.title}” · submitted{" "}
                      {formatDate(verification.submitted_at)}
                    </span>
                  </span>
                  <StatusPill tone={verificationStatusTone(verification.status)}>
                    {verificationStatusLabel(verification.status)}
                  </StatusPill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
