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
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
          >
            <p className="text-3xl font-medium tracking-[-0.03em] text-slate-950">
              {item.count}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">{item.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-medium text-slate-950">Add to RentalIntel</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          List a property you own, add the place you live in, or add one on
          someone&apos;s behalf. Every submission is reviewed before it&apos;s published.
        </p>
        <Link
          href="/add-property"
          className="mt-4 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
        >
          Add a property →
        </Link>
      </div>
    </div>
  );
}
