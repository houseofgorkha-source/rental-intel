import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/shared/StatusPrimitives";
import {
  propertyStatusLabel,
  propertyStatusTone,
  roleLabel,
} from "@/components/account/AccountPrimitives";
import { formatINRPerMonth, getPropertyImageUrl } from "@/lib/property-format";
import PropertyModerationActions from "@/components/admin/PropertyModerationActions";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAmount(value: number | null) {
  return value === null ? "Not provided" : formatINRPerMonth(value);
}

// Everything the submitter typed, laid out so it can be read against reality
// — that is the whole job. A moderator is checking whether this property is
// real, identifiable and not a duplicate, so nothing they were given is
// hidden behind a disclosure and nothing is summarised away.
export default async function AdminPropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!property) notFound();

  const [{ data: images }, { data: contributor }, { data: reviews }] = await Promise.all([
    supabase
      .from("property_images")
      .select("storage_path, alt_text")
      .eq("property_id", property.id)
      .order("sort_order"),
    property.created_by
      ? supabase
          .from("profiles")
          .select("display_name, created_at")
          .eq("id", property.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("reviews")
      .select("id, title, overall_rating, verification_status, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false }),
  ]);

  const isOwnerListing = property.submitted_as === "owner";

  const submission: { label: string; value: string }[] = [
    { label: "Address", value: property.address_line_1 },
    ...(property.address_line_2 ? [{ label: "Address line 2", value: property.address_line_2 }] : []),
    ...(property.landmark ? [{ label: "Landmark", value: property.landmark }] : []),
    { label: "Area", value: property.area },
    { label: "City", value: property.city },
    { label: "State", value: property.state },
    ...(property.postal_code ? [{ label: "PIN code", value: property.postal_code }] : []),
    ...(property.notes ? [{ label: "Notes (legacy field)", value: property.notes }] : []),
    { label: "Slug", value: property.slug },
    { label: "Submitted", value: formatDateTime(property.created_at) },
  ];

  const listing = isOwnerListing
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
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/properties"
          className="rounded-lg px-1 py-0.5 text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          ← Back to properties
        </Link>
        <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] text-slate-950">
          {property.name}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill tone={propertyStatusTone(property.status)}>
            {propertyStatusLabel(property.status)}
          </StatusPill>
          <StatusPill tone="neutral">{roleLabel(property.submitted_as)}</StatusPill>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-medium text-slate-950">Decision</h3>
        <div className="mt-4">
          <PropertyModerationActions slug={property.slug} status={property.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section
          aria-labelledby="submission-details"
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h3 id="submission-details" className="text-base font-medium text-slate-950">
            What was submitted
          </h3>
          <dl className="mt-4 flex flex-col gap-3">
            {submission.map((item) => (
              <div
                key={item.label}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-sm text-slate-500">{item.label}</dt>
                <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {property.maps_url && (
            <a
              href={property.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
            >
              Open the submitted map link ↗
            </a>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="contributor"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 id="contributor" className="text-base font-medium text-slate-950">
              Who submitted it
            </h3>
            <p className="mt-3 text-sm font-medium text-slate-900">
              {contributor?.display_name ?? "Contributor no longer on RentalIntel"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              They described themselves as{" "}
              <span className="font-medium text-slate-900">
                {roleLabel(property.submitted_as).toLowerCase()}
              </span>
              . This is a self-declared claim and has not been verified.
            </p>
          </section>

          {isOwnerListing && (
            <section
              aria-labelledby="listing-details"
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 id="listing-details" className="text-base font-medium text-slate-950">
                Listing details
              </h3>
              <dl className="mt-4 flex flex-col gap-2.5">
                {listing.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-slate-500">{item.label}</dt>
                    <dd className="text-sm font-medium text-slate-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section
            aria-labelledby="attached-reviews"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 id="attached-reviews" className="text-base font-medium text-slate-950">
              Reviews attached
            </h3>
            {(reviews ?? []).length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                None yet. Publishing this property makes any future reviews
                visible to everyone.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {(reviews ?? []).map((review) => (
                  <li key={review.id} className="text-sm">
                    <span className="font-medium text-slate-900">{review.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {review.overall_rating}/5 · {review.verification_status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="submitted-images">
        <h3 id="submitted-images" className="text-base font-medium text-slate-950">
          Images submitted
        </h3>
        {(images ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No images were uploaded.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(images ?? []).map((image) => (
              // The bucket accepts user uploads, so its public URLs are intentionally rendered directly.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.storage_path}
                src={getPropertyImageUrl(supabase, image.storage_path)}
                alt={image.alt_text || property.name}
                className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
              />
            ))}
          </div>
        )}
      </section>

      {property.status === "published" && (
        <Link
          href={`/property/${property.slug}`}
          className="inline-flex w-fit text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
        >
          See the public property page →
        </Link>
      )}
    </div>
  );
}
