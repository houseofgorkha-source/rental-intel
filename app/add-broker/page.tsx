import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrokerForm, { type ExistingBroker } from "@/components/add-broker/BrokerForm";
import { isContactMethod } from "@/lib/property-attributes";

export const dynamic = "force-dynamic";

// One route for both registering and amending — a signed-in user with an
// existing listing (brokers.created_by is unique) sees the same form
// prefilled, the same "create-vs-edit" auto-detection ReviewForm already
// uses for reviews, rather than a second page.
export default async function AddBrokerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/add-broker");

  const { data: broker } = await supabase
    .from("brokers")
    .select("id, name, agency_name, city, areas, bio, contact_method")
    .eq("created_by", user.id)
    .maybeSingle();

  let existingBroker: ExistingBroker | undefined;
  if (broker) {
    const { data: contact } = await supabase
      .from("broker_contacts")
      .select("phone, email")
      .eq("broker_id", broker.id)
      .maybeSingle();

    existingBroker = {
      name: broker.name,
      agencyName: broker.agency_name,
      city: broker.city,
      areas: broker.areas ?? [],
      bio: broker.bio,
      contactMethod: isContactMethod(broker.contact_method) ? broker.contact_method : "none",
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null,
    };
  }

  return (
    <main className="min-h-screen bg-surface pb-12 pt-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {existingBroker ? "Edit Your Broker Listing" : "List Yourself as a Broker"}
          </h1>
          <p className="mt-3 text-muted">
            {existingBroker
              ? "Update how renters find and reach you."
              : "Renters looking for help in your areas will be able to find and contact you."}
          </p>
        </div>

        <div className="mt-10">
          <BrokerForm existingBroker={existingBroker} />
        </div>
      </div>
    </main>
  );
}
