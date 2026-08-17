import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/lib/property-attributes";

export type Broker = {
  id: string;
  name: string;
  agencyName: string | null;
  city: string;
  areas: string[];
  bio: string | null;
  contactMethod: ContactMethod;
  phone: string | null;
  email: string | null;
};

// The directory's one card, matching PropertyList's card language (border,
// radius, hover treatment) without literally reusing that component — a
// broker has none of a property's fields (rent, rating, images).
export default function BrokerCard({ broker }: { broker: Broker }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-5 transition hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)]">
      <div>
        <h3 className="text-base font-medium tracking-[-0.01em] text-foreground">
          {broker.name}
        </h3>
        {broker.agencyName && (
          <p className="text-sm text-muted">{broker.agencyName}</p>
        )}
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {broker.areas.length > 0 ? broker.areas.join(", ") : broker.city}
      </p>

      {broker.bio && <p className="text-sm text-muted">{broker.bio}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {broker.contactMethod === "phone" && broker.phone && (
          <a
            href={`tel:${broker.phone}`}
            className="rounded-full bg-accent/10 px-3 py-1.5 font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            Call {broker.phone}
          </a>
        )}
        {broker.contactMethod === "email" && broker.email && (
          <a
            href={`mailto:${broker.email}`}
            className="rounded-full bg-accent/10 px-3 py-1.5 font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            Email {broker.email}
          </a>
        )}
        {(broker.contactMethod === "message" || broker.contactMethod === "none") && (
          <span className="rounded-full border border-border-subtle px-3 py-1.5 text-muted">
            {CONTACT_METHOD_LABELS[broker.contactMethod]}
          </span>
        )}
      </div>
    </article>
  );
}
