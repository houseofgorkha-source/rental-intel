import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReviewForm from "../../../../components/review/ReviewForm";

type ReviewPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ReviewPage({
  params,
}: ReviewPageProps) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/property/${slug}/review`);

  // `select("*")` rather than naming submitted_as: a named column that
  // doesn't exist yet (pending migration) fails the whole query and would
  // 404 this page, whereas `*` simply omits it and the owner check below
  // falls back to the pre-existing behaviour.
  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !property) {
    notFound();
  }

  // Anyone can review a published property; a property's own creator can
  // also review it while it's still pending approval — everyone else must
  // wait, same as the reviews RLS insert policy enforces server-side.
  if (property.status !== "published" && property.created_by !== user.id) {
    notFound();
  }

  // An owner cannot review the property they listed. This mirrors the RLS
  // insert policy exactly so the UI never offers something the database
  // would reject — the database remains the actual boundary.
  if (property.submitted_as === "owner" && property.created_by === user.id) {
    notFound();
  }

  return (
    // `pt-28`, matching the header-clearance convention used elsewhere
    // (account/admin/property-detail) — `py-12` (48px) wasn't enough to
    // clear the absolutely-positioned header. `px-4` on mobile (was px-6)
    // widens the form; sm:px-6 unchanged.
    <main className="min-h-screen bg-surface pb-12 pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">

        <Link
          href={`/property/${property.slug}`}
          className="inline-flex items-center text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          ← Back to Property
        </Link>

        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface p-8">

          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Share Your Experience
          </h1>

          <p className="mt-3 text-muted">
            Help future tenants by sharing your honest experience at{" "}
            <span className="font-medium text-foreground">
              {property.name}
            </span>.
          </p>

        </div>

        <div className="mt-8">
          <ReviewForm propertyId={property.id} propertyArea={property.area} />
        </div>

      </div>
    </main>
  );
}
