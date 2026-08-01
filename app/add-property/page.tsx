import PropertyForm from "@/components/add-property/PropertyForm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AddPropertyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/add-property");
  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <PropertyForm />
    </main>
  );
}
