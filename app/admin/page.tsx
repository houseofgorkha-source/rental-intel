import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/embedded";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import { roleLabel } from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

type PendingProperty = {
  slug: string;
  name: string;
  area: string;
  city: string;
  submitted_as: "owner" | "tenant" | "helper" | null;
  created_at: string;
};

// PostgREST returns these many-to-one embeds as objects, not arrays — see
// lib/embedded.ts. Both shapes are accepted so the reading code is correct
// either way.
type EmbeddedReview = { title: string; properties: { name: string } | { name: string }[] };

type PendingVerification = {
  id: string;
  submitted_at: string;
  reviews: EmbeddedReview | EmbeddedReview[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// The queue is the landing surface because moderation is a queue, not a
// dashboard: the first question is always "what is waiting for me", never
// "how are we trending". No charts, no activity feed, no vanity totals — the
// two numbers that represent unfinished work are given the weight, and
// everything else is context.
export default async function AdminQueuePage() {
  const supabase = await createClient();

  const [
    pendingProperties,
    pendingVerifications,
    publishedCount,
    rejectedCount,
    reviewCount,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("slug, name, area, city, submitted_as, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("review_verifications")
      .select("id, submitted_at, reviews!inner(title, properties!inner(name))")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
  ]);

  const properties = (pendingProperties.data ?? []) as PendingProperty[];
  const verifications = (pendingVerifications.data ?? []) as PendingVerification[];

  const waiting = [
    {
      label: "Properties awaiting approval",
      count: properties.length,
      href: "/admin/properties",
    },
    {
      label: "Stay verifications awaiting a decision",
      count: verifications.length,
      href: "/admin/verifications",
    },
  ];

  const context = [
    { label: "Published", value: publishedCount.count ?? 0 },
    { label: "Not approved", value: rejectedCount.count ?? 0 },
    { label: "Reviews on record", value: reviewCount.count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* The only dark surface in the product. It marks the moderation
          workspace as a different place from the public site without
          inventing a second visual language for it. */}
      <div className="grid gap-px overflow-hidden rounded-2xl bg-slate-800 sm:grid-cols-2">
        {waiting.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group bg-slate-950 p-6 transition hover:bg-slate-900 focus:outline-none focus-visible:bg-slate-900"
          >
            <p className="text-4xl font-medium tracking-[-0.04em] text-white tabular-nums">
              {item.count}
            </p>
            <p className="mt-2 text-sm text-slate-300 group-hover:text-white">
              {item.label} →
            </p>
          </Link>
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        {context.map((item) => (
          <div key={item.label} className="flex items-baseline gap-2">
            <dt className="text-sm text-slate-500">{item.label}</dt>
            <dd className="text-sm font-medium text-slate-900 tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="queue-properties">
        <h2 id="queue-properties" className="text-lg font-medium tracking-[-0.02em] text-slate-950">
          Properties awaiting approval
        </h2>
        <p className="mt-1 text-sm text-slate-500">Oldest first.</p>

        <div className="mt-4">
          {properties.length === 0 ? (
            <EmptyState
              title="Nothing waiting for approval."
              description="New property submissions appear here as soon as someone adds one."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {properties.slice(0, 8).map((property) => (
                <li key={property.slug}>
                  <Link
                    href={`/admin/properties/${property.slug}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-500 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-950">
                        {property.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {property.area}, {property.city} · submitted {formatDate(property.created_at)}
                      </span>
                    </span>
                    <StatusPill tone="neutral">{roleLabel(property.submitted_as)}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="queue-verifications">
        <h2 id="queue-verifications" className="text-lg font-medium tracking-[-0.02em] text-slate-950">
          Stay verifications awaiting a decision
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Each one has documents attached. Open it to see them.
        </p>

        <div className="mt-4">
          {verifications.length === 0 ? (
            <EmptyState
              title="No verification requests waiting."
              description="A request appears here when someone who has written a review uploads proof that they stayed there."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {verifications.slice(0, 8).map((verification) => {
                const review = one(verification.reviews);
                const property = one(review?.properties);

                return (
                  <li key={verification.id}>
                    <Link
                      href={`/admin/verifications/${verification.id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-500 hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-950">
                          {property?.name ?? "Property"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          “{review?.title}” · submitted {formatDate(verification.submitted_at)}
                        </span>
                      </span>
                      <StatusPill tone="pending">Pending</StatusPill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
