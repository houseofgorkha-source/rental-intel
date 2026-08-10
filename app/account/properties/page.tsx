import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatINRPerMonth, getPropertyImageUrl } from "@/lib/property-format";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import {
  propertyStatusLabel,
  propertyStatusTone,
  roleLabel,
} from "@/components/account/AccountPrimitives";
import PendingSubmissionActions from "@/components/account/PendingSubmissionActions";

export const dynamic = "force-dynamic";

type PropertyRow = {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  status: "pending" | "published" | "rejected";
  submitted_as: "owner" | "tenant" | "helper" | null;
  asking_rent: number | null;
  is_available: boolean;
};

export default async function AccountPropertiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/properties");

  // No new RLS needed: the existing "Published properties are publicly
  // readable" policy already includes `or created_by = auth.uid()`.
  const { data } = await supabase
    .from("properties")
    .select("id, slug, name, area, city, status, submitted_as, asking_rent, is_available")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const properties = (data ?? []) as PropertyRow[];

  // Same first-image-per-property shape the discovery cards use, so a
  // contributor's own card looks like the card everyone else will see.
  const { data: imageRows } = properties.length
    ? await supabase
        .from("property_images")
        .select("property_id, storage_path, alt_text")
        .in("property_id", properties.map((property) => property.id))
        .order("sort_order")
    : { data: [] };

  const firstImage = new Map<string, { src: string; alt: string }>();
  (imageRows ?? []).forEach((image) => {
    if (firstImage.has(image.property_id)) return;
    firstImage.set(image.property_id, {
      src: getPropertyImageUrl(supabase, image.storage_path),
      alt: image.alt_text || "Property image",
    });
  });

  if (properties.length === 0) {
    return (
      <EmptyState
        title="You haven't added a property yet."
        description="Add a property you own, one you live in, or one you know about. It goes live as soon as you submit it."
        actionHref="/add-property"
        actionLabel="Add a property →"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* A property's name and address can never be edited — reviews attach to
          them permanently (CLAUDE.md §26) — so the only way to correct a
          mistake is to remove the submission while it is still pending and
          add it again. Saying so here prevents the "where is the edit
          button?" dead end. */}
      <p className="text-sm leading-6 text-muted">
        You can keep a property&apos;s details, rent and availability current at any
        time — its name and address can&apos;t change, because reviews stay attached
        to them. You can remove a property while it&apos;s still pending approval;
        once published it becomes part of the shared record.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => {
          const image = firstImage.get(property.id);
          const isOwnerListing = property.submitted_as === "owner";

          return (
            <li key={property.slug}>
              {/* Same card grammar as the discovery cards (PropertyList):
                  one destination, whole card clickable, hover and
                  focus-within share the same highlight. The link is
                  stretched with a ::before overlay rather than wrapping the
                  card, because a pending card also carries a destructive
                  Remove control — and a button nested inside an anchor is
                  both invalid and unusable. Remove sits above the overlay on
                  its own stacking level, so it can never navigate. */}
              <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface transition hover:border-border-subtle hover:shadow-[0_18px_45px_-30px_rgba(14,143,94,0.45)] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
                <div className="relative aspect-[5/2] bg-surface-raised">
                  <span className="absolute right-2 top-2 z-10">
                    <StatusPill tone={propertyStatusTone(property.status)}>
                      {propertyStatusLabel(property.status)}
                    </StatusPill>
                  </span>
                  {image ? (
                    // The bucket accepts user uploads, so its public URLs are intentionally rendered directly.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-end bg-[linear-gradient(145deg,#eef5f0,#fbfdfb_58%,#dbe9e0)] p-3">
                      <span className="text-xs font-medium text-muted">
                        No image added
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                    {property.area}, {property.city}
                  </p>
                  <h2 className="mt-1 text-sm font-medium tracking-[-0.02em] text-foreground">
                    <Link
                      href={`/property/${property.slug}`}
                      className="line-clamp-2 rounded-sm before:absolute before:inset-0 before:content-[''] focus:outline-none"
                    >
                      {property.name}
                    </Link>
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="neutral">{roleLabel(property.submitted_as)}</StatusPill>
                    {isOwnerListing && (
                      <StatusPill tone={property.is_available ? "success" : "neutral"}>
                        {property.is_available ? "Available for rent" : "Not available"}
                      </StatusPill>
                    )}
                  </div>

                  {isOwnerListing && property.asking_rent !== null && (
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatINRPerMonth(property.asking_rent)}
                    </p>
                  )}

                  {/* Both controls sit above the stretched link's overlay on
                      their own stacking level, so neither can navigate.
                      Edit is offered at every status: keeping rent,
                      availability and attributes current is exactly what a
                      published property needs, and the database restricts what
                      the form can reach. Remove stays pending-only — a
                      published property is part of the shared record and the
                      delete policy refuses it. */}
                  <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-3">
                    <Link
                      href={`/account/properties/${property.slug}/edit`}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      Edit
                    </Link>
                    {property.status === "pending" && (
                      <PendingSubmissionActions slug={property.slug} name={property.name} />
                    )}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
