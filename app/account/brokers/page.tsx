import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import BrokerListingActions from "@/components/account/BrokerListingActions";

export const dynamic = "force-dynamic";

export default async function AccountBrokersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/brokers");

  const { data: broker } = await supabase
    .from("brokers")
    .select("id, name, agency_name, city, areas, is_active")
    .eq("created_by", user.id)
    .maybeSingle();

  if (!broker) {
    return (
      <EmptyState
        title="You haven't listed yourself as a broker yet."
        description="Renters browsing the broker directory will be able to find and contact you once you do."
        actionHref="/add-broker"
        actionLabel="List yourself as a broker →"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-foreground">{broker.name}</h2>
            {broker.agency_name && (
              <p className="text-sm text-muted">{broker.agency_name}</p>
            )}
            <p className="mt-1 text-sm text-muted">
              {broker.areas.length > 0 ? broker.areas.join(", ") : broker.city}
            </p>
          </div>
          <StatusPill tone={broker.is_active ? "success" : "neutral"}>
            {broker.is_active ? "Listed" : "Not listed"}
          </StatusPill>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/add-broker"
            className="text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
          >
            Edit listing
          </Link>
          {broker.is_active && <BrokerListingActions />}
        </div>
      </div>
    </div>
  );
}
