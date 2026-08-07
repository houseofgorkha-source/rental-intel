import PropertyForm from "@/components/add-property/PropertyForm";
import { isSubmitterRole } from "@/lib/property-roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AddPropertyPageProps = {
  // `as` seeds the role selection from the homepage's "List Your Property"
  // entry points. It's a convenience only — the selector is always shown and
  // the value is re-validated server-side in createProperty.
  searchParams: Promise<{ as?: string }>;
};

export default async function AddPropertyPage({ searchParams }: AddPropertyPageProps) {
  const { as } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = as ? `/add-property?as=${encodeURIComponent(as)}` : "/add-property";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <PropertyForm initialRole={isSubmitterRole(as) ? as : null} />
    </main>
  );
}
