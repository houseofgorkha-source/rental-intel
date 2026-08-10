import PropertyForm from "@/components/add-property/PropertyForm";
import { isSubmitterRole } from "@/lib/property-roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AddPropertyPageProps = {
  // `as` seeds the role selection from the homepage's "List Your Property"
  // entry points. It's a convenience only — the selector is always shown and
  // the value is re-validated server-side in createProperty.
  //
  // `intent=review` arrives from /review's "can't find your property, add
  // it" fallback — it only changes where a successful submission redirects
  // to (see PropertyForm), never anything about validation or authorization.
  searchParams: Promise<{ as?: string; intent?: string }>;
};

export default async function AddPropertyPage({ searchParams }: AddPropertyPageProps) {
  const { as, intent } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const query = new URLSearchParams();
  if (as) query.set("as", as);
  if (intent) query.set("intent", intent);
  const queryString = query.toString();

  if (!user) {
    const next = queryString ? `/add-property?${queryString}` : "/add-property";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="min-h-screen bg-background">
      <PropertyForm
        initialRole={isSubmitterRole(as) ? as : null}
        redirectToReviewAfterSubmit={intent === "review"}
      />
    </main>
  );
}
