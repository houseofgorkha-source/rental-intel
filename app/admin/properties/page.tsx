import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import {
  propertyStatusLabel,
  propertyStatusTone,
  roleLabel,
} from "@/components/account/AccountPrimitives";

export const dynamic = "force-dynamic";

type AdminPropertyRow = {
  slug: string;
  name: string;
  area: string;
  city: string;
  status: "pending" | "published" | "rejected";
  submitted_as: "owner" | "tenant" | "helper" | null;
  created_at: string;
  created_by: string | null;
};

const filters = [
  { value: "pending", label: "Awaiting approval" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Not approved" },
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

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter: FilterValue = isFilterValue(status) ? status : "pending";

  const supabase = await createClient();

  // Only an administrator sees anything here: the "Administrators can read
  // every property" policy is what widens this past published + own rows.
  let query = supabase
    .from("properties")
    .select("slug, name, area, city, status, submitted_as, created_at, created_by");

  if (activeFilter !== "all") query = query.eq("status", activeFilter);

  const { data } = await query.order("created_at", {
    ascending: activeFilter === "pending",
  });

  const properties = (data ?? []) as AdminPropertyRow[];

  // Who submitted each one. profiles is publicly readable, so this needs no
  // policy of its own — and display_name is all the schema holds about a
  // contributor. There is no email here and none should be added: moderating
  // a submission is a decision about the submission.
  const contributorIds = [
    ...new Set(properties.map((property) => property.created_by).filter(Boolean)),
  ] as string[];

  const { data: profileRows } = contributorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", contributorIds)
    : { data: [] };

  const contributorName = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter.value === activeFilter;
          return (
            <Link
              key={filter.value}
              href={`/admin/properties?status=${filter.value}`}
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

      {properties.length === 0 ? (
        <EmptyState
          title="Nothing here right now."
          description="Try another status filter, or come back when new submissions arrive."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {properties.map((property) => (
            <li key={property.slug}>
              <Link
                href={`/admin/properties/${property.slug}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 transition hover:border-accent hover:shadow-[0_18px_45px_-30px_rgba(14,143,94,0.45)] focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {property.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {property.area}, {property.city} ·{" "}
                    {property.created_by
                      ? contributorName.get(property.created_by) ?? "Unknown contributor"
                      : "Contributor removed"}{" "}
                    · {formatDate(property.created_at)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <StatusPill tone="neutral">{roleLabel(property.submitted_as)}</StatusPill>
                  <StatusPill tone={propertyStatusTone(property.status)}>
                    {propertyStatusLabel(property.status)}
                  </StatusPill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
