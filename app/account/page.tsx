import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Deliberately just counts and links — no charts, no activity feed, no
// analytics. The account area exists so a contributor can find their own
// submissions again; everything richer lives on the property page itself.
export default async function AccountOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [properties, reviews, verifications] = await Promise.all([
    supabase
      .from("properties")
      .select("slug", { count: "exact", head: true })
      .eq("created_by", user.id),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    supabase
      .from("review_verifications")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id),
  ]);

  const summary = [
    { label: "Properties added", count: properties.count ?? 0, href: "/account/properties" },
    { label: "Reviews written", count: reviews.count ?? 0, href: "/account/reviews" },
    { label: "Verifications", count: verifications.count ?? 0, href: "/account/verifications" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-border-subtle bg-surface p-5 transition hover:border-border-subtle"
          >
            <p className="text-3xl font-medium tracking-[-0.03em] text-foreground">
              {item.count}
            </p>
            <p className="mt-1.5 text-sm text-muted">{item.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-base font-medium text-foreground">Add to RentalIntel</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          List a property you own, add the place you live in, or add one on
          someone&apos;s behalf. It goes live as soon as you submit it.
        </p>
        <Link
          href="/add-property"
          className="mt-4 inline-flex text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
        >
          Add a property →
        </Link>
      </div>
    </div>
  );
}
