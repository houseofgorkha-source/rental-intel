import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatINRPerMonth } from "@/lib/property-format";
import { StatusPill, roleLabel } from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

type ListingEditPageProps = {
  params: Promise<{ slug: string }>;
};

function formatAmount(value: number | null) {
  return value === null ? "Not provided" : formatINRPerMonth(value);
}

// Read-only on purpose.
//
// Editing listing details needs an UPDATE policy on `properties` (plus the
// column-level grant that keeps name/address/slug/status unreachable), and
// that privilege change is deliberately deferred. Rather than 404 a route
// that is registered in the developer navigation and may be bookmarked, this
// shows the current values and states plainly that editing isn't available
// yet. No action is offered that the database would refuse.
export default async function ListingEditPage({ params }: ListingEditPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/properties/${slug}/edit`)}`);

  // Scoped to the creator here as well as in RLS. The properties SELECT
  // policy would already hide another user's unpublished property, but a
  // *published* one is publicly readable — so the created_by filter is what
  // actually keeps this page creator-only.
  const { data: property } = await supabase
    .from("properties")
    .select("slug, name, asking_rent, security_deposit, is_available, submitted_as")
    .eq("slug", slug)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!property) notFound();

  const isOwnerListing = property.submitted_as === "owner";

  const details = isOwnerListing
    ? [
        { label: "Monthly rent", value: formatAmount(property.asking_rent) },
        { label: "Security deposit", value: formatAmount(property.security_deposit) },
        {
          label: "Availability",
          value: property.is_available ? "Available for rent" : "Not currently available",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/account/properties"
          className="rounded-lg px-1 py-0.5 text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          ← Back to my properties
        </Link>
        <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] text-slate-950">
          {property.name}
        </h2>
        <div className="mt-3">
          <StatusPill tone="neutral">{roleLabel(property.submitted_as)}</StatusPill>
        </div>
      </div>

      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Editing listing details isn&apos;t available yet. A property&apos;s name and
          address can never be changed — reviews are permanently attached to
          them — and rent, deposit and availability aren&apos;t editable in the
          product yet.
        </p>

        {isOwnerListing ? (
          <dl className="mt-6 flex flex-col gap-4">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-slate-600">{detail.label}</dt>
                <dd className="text-sm font-medium text-slate-950">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-6 text-sm leading-6 text-slate-600">
            This property was added as a knowledge contribution rather than an
            owner listing, so it has no rent, deposit or availability details.
          </p>
        )}
      </div>
    </div>
  );
}
