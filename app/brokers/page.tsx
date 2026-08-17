import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BrokerDirectory from "@/components/broker/BrokerDirectory";
import type { Broker } from "@/components/broker/BrokerCard";
import { isContactMethod } from "@/lib/property-attributes";
import { BROKER_COMMUNITY_GROUPS } from "@/lib/broker-community-groups";

export const dynamic = "force-dynamic";

type BrokerRow = {
  id: string;
  name: string;
  agency_name: string | null;
  city: string;
  areas: string[];
  bio: string | null;
  contact_method: string;
  broker_contacts: { phone: string | null; email: string | null } | { phone: string | null; email: string | null }[] | null;
};

export default async function BrokersPage() {
  const supabase = await createClient();

  // Both `brokers` (is_active rows) and `broker_contacts` are publicly
  // readable per 20260820000000_add_broker_directory.sql — a broker
  // directory's whole point is being reachable without an account.
  const { data } = await supabase
    .from("brokers")
    .select("id, name, agency_name, city, areas, bio, contact_method, broker_contacts(phone, email)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const brokers: Broker[] = ((data ?? []) as BrokerRow[]).map((row) => {
    const contact = Array.isArray(row.broker_contacts)
      ? row.broker_contacts[0]
      : row.broker_contacts;

    return {
      id: row.id,
      name: row.name,
      agencyName: row.agency_name,
      city: row.city,
      areas: row.areas ?? [],
      bio: row.bio,
      contactMethod: isContactMethod(row.contact_method) ? row.contact_method : "none",
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
    };
  });

  return (
    <main className="min-h-screen bg-background pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-[-0.03em] text-foreground sm:text-4xl">
              Brokers
            </h1>
            <p className="mt-2 text-sm text-muted sm:text-base">
              Registered by brokers themselves — not verified by RentalIntel.
            </p>
          </div>
          <Link
            href="/add-broker"
            className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            List yourself as a broker
          </Link>
        </div>

        <div className="mt-8">
          <BrokerDirectory brokers={brokers} />
        </div>

        {/* External links only — no group content, member names, or posts
            are pulled in. A small hand-picked, periodically re-checked list
            (lib/broker-community-groups.ts), not user-submitted or scraped
            data. */}
        <section className="mt-16 border-t border-border-subtle pt-10">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
            Elsewhere
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-foreground">
            Community groups
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Active rental/flatmate communities outside RentalIntel. These
            aren&apos;t run by RentalIntel — links only, to real public
            groups.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {BROKER_COMMUNITY_GROUPS.map((group) => (
              <li key={group.url}>
                <a
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
                >
                  {group.name}
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
