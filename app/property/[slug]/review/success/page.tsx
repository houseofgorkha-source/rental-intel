import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SuccessPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ reviewId?: string }>;
};

export default async function SuccessPage({
  params,
  searchParams,
}: SuccessPageProps) {
  const { slug } = await params;
  const { reviewId } = await searchParams;
  if (!reviewId) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: review } = await supabase
    .from("reviews")
    .select("id, properties!inner(slug)")
    .eq("id", reviewId)
    .eq("author_id", user.id)
    .eq("properties.slug", slug)
    .maybeSingle();
  if (!review) notFound();

  const propertyName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface p-10 text-center">

        <div className="text-7xl">
          🏠✨
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">
          You just helped the next renter.
        </h1>

        <p className="mt-5 text-xl font-semibold text-foreground">
          {propertyName}
        </p>

        <p className="mt-4 text-muted">
          Your experience has been submitted and will help future tenants make
          smarter rental decisions.
        </p>

        <div className="mt-10 rounded-2xl border border-border-subtle bg-surface-raised p-6">

          <h2 className="text-xl font-semibold text-foreground">
            Review Status
          </h2>

          <div className="mt-6 space-y-5 text-left">

            <div className="flex items-center gap-4">
              <span className="text-2xl">✅</span>

              <div>
                <p className="font-semibold text-foreground">
                  Review Published
                </p>

                <p className="text-sm text-muted">
                  Your review is now visible to the RentalIntel community.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⚪</span>

              <div>
                <p className="font-semibold text-foreground">
                  Unverified
                </p>

                <p className="text-sm text-muted">
                  Verification increases credibility, not the right to be heard.
                </p>
              </div>
            </div>

          </div>

        </div>

        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface p-6 text-left">

          <h2 className="text-xl font-semibold text-foreground">
            Your Review Journey
          </h2>

          <div className="mt-6 space-y-5">

            <div className="flex items-center gap-4">
              <span className="text-2xl">✅</span>

              <div>
                <p className="font-semibold text-foreground">
                  Review Published
                </p>

                <p className="text-sm text-muted">
                  Your experience is helping future renters today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⬜</span>

              <div>
                <p className="font-semibold text-foreground">
                  Become a Verified Tenant
                </p>

                <p className="text-sm text-muted">
                  Upload supporting documents to verify your stay.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl">⬜</span>

              <div>
                <p className="font-semibold text-foreground">
                  Earn Trusted Contributor
                </p>

                <p className="text-sm text-muted">
                  Continue writing useful reviews for the community.
                </p>
              </div>
            </div>

          </div>

        </div>

        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface-raised p-6 text-left">

          <h3 className="text-lg font-semibold text-foreground">
            Earn a Verification Badge
          </h3>

          <p className="mt-3 text-muted">
            Upload your rental agreement or supporting documents to earn a{" "}
            <strong>Verified Tenant</strong> badge.
          </p>

          <p className="mt-4 text-sm text-muted">
            Verified reviews help renters make informed decisions while keeping
            RentalIntel trustworthy.
          </p>

        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">

          <Link
            href={`/property/${slug}`}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            ← Return to Property
          </Link>

          <Link
            href={`/property/${slug}/review/verify?reviewId=${reviewId ?? ""}`}
            className="inline-flex items-center justify-center rounded-full border border-border-subtle bg-surface px-6 py-4 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent"
          >
            🛡 Verify My Review
          </Link>

        </div>

      </div>
    </main>
  );
}
