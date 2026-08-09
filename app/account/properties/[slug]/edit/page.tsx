import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PropertyEditForm, {
  type EditableProperty,
} from "@/components/account/PropertyEditForm";
import { isContactMethod } from "@/lib/property-attributes";

export const dynamic = "force-dynamic";

type EditPropertyPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/properties/${slug}/edit`)}`);

  // Scoped to the signed-in creator. This is not the security boundary — the
  // "Contributors can update their own property" policy is, and it would
  // refuse the write regardless — but it means somebody else's property 404s
  // rather than rendering a form that can only fail on submit.
  const { data: property } = await supabase
    .from("properties")
    .select(
      "id, slug, name, area, city, address_line_1, submitted_as, landmark, configuration, property_type, furnishing, carpet_area_sqft, asking_rent, security_deposit, is_available, contact_method",
    )
    .eq("slug", slug)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!property) notFound();

  const { data: contact } = await supabase
    .from("property_contacts")
    .select("phone, email")
    .eq("property_id", property.id)
    .maybeSingle();

  const editable: EditableProperty = {
    slug: property.slug,
    name: property.name,
    area: property.area,
    city: property.city,
    addressLine1: property.address_line_1,
    submittedAs: property.submitted_as,
    landmark: property.landmark,
    configuration: property.configuration,
    propertyType: property.property_type,
    furnishing: property.furnishing,
    carpetAreaSqft: property.carpet_area_sqft,
    askingRent: property.asking_rent,
    securityDeposit: property.security_deposit,
    isAvailable: property.is_available,
    contactMethod: isContactMethod(property.contact_method)
      ? property.contact_method
      : "none",
    contactPhone: contact?.phone ?? null,
    contactEmail: contact?.email ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/account/properties"
          className="text-sm font-medium text-muted underline decoration-border-subtle underline-offset-4 transition hover:text-foreground"
        >
          ← My properties
        </Link>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-foreground">
          Edit property
        </h1>
        {/* Editing does not send a published property back for re-approval:
            these are the commercial and descriptive facts, not the property's
            identity, and re-queuing a live listing every time a rent changed
            would make the listing unusable. Moderation state is untouched by
            this form — the database enforces that, not this page. */}
        <p className="mt-2 text-sm leading-6 text-muted">
          Changes here go live immediately. Approval only applies to a property
          being added, not to keeping its details current.
        </p>
      </div>

      <PropertyEditForm property={editable} />
    </div>
  );
}
