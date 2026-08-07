import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatINRPerMonth } from "@/lib/property-format";
import {
  EmptyState,
  StatusPill,
  propertyStatusLabel,
  propertyStatusTone,
  roleLabel,
} from "@/components/account/AccountPrimitives";
import PendingSubmissionActions from "@/components/account/PendingSubmissionActions";

export const dynamic = "force-dynamic";

type PropertyRow = {
  slug: string;
  name: string;
  area: string;
  city: string;
  status: "pending" | "published" | "rejected";
  submitted_as: "owner" | "tenant" | "helper" | null;
  asking_rent: number | null;
  is_available: boolean;
  created_at: string;
};

export default async function AccountPropertiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/properties");

  // No new RLS needed: the existing "Published properties are publicly
  // readable" policy already includes `or created_by = auth.uid()`.
  const { data } = await supabase
    .from("properties")
    .select("slug, name, area, city, status, submitted_as, asking_rent, is_available, created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const properties = (data ?? []) as PropertyRow[];

  if (properties.length === 0) {
    return (
      <EmptyState
        title="You haven't added a property yet."
        description="Add a property you own, one you live in, or one you know about. Every submission is reviewed before it's published."
        actionHref="/add-property"
        actionLabel="Add a property →"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A property's name and address can never be edited — reviews attach to
          them permanently (CLAUDE.md §26) — so the only way to correct a
          mistake is to remove the submission while it is still pending and
          add it again. Saying so here prevents the "where is the edit
          button?" dead end. */}
      <p className="text-sm leading-6 text-slate-600">
        Submitted something incorrectly? You can remove a property while
        it&apos;s still pending approval and add it again. Once published, a
        property becomes part of the shared record and can no longer be
        removed.
      </p>

      <ul className="flex flex-col gap-3">
        {properties.map((property) => (
          <li
            key={property.slug}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                {property.area}, {property.city}
              </p>
              <h2 className="mt-1 truncate text-base font-medium text-slate-950">
                {property.name}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusPill tone={propertyStatusTone(property.status)}>
                  {propertyStatusLabel(property.status)}
                </StatusPill>
                <StatusPill tone="neutral">
                  {roleLabel(property.submitted_as)}
                </StatusPill>
                {property.submitted_as === "owner" && (
                  <StatusPill tone={property.is_available ? "success" : "neutral"}>
                    {property.is_available ? "Available for rent" : "Not available"}
                  </StatusPill>
                )}
                {property.submitted_as === "owner" && property.asking_rent !== null && (
                  <span className="text-sm text-slate-600">
                    {formatINRPerMonth(property.asking_rent)}
                  </span>
                )}
              </div>
            </div>

            {/* Explicit controls rather than a clickable row: this carries two
                actions, one of them destructive. "Manage listing" is
                deliberately absent for every role — listing edits require a
                property UPDATE policy that has not been applied yet, so
                advertising the action would lead to a guaranteed failure. */}
            <div className="flex shrink-0 flex-wrap items-start gap-4">
              <Link
                href={`/property/${property.slug}`}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
              >
                View
              </Link>
              {property.status === "pending" && (
                <PendingSubmissionActions
                  slug={property.slug}
                  name={property.name}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
