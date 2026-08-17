import Link from "next/link";

// A separate entry point from ListYourPropertySection deliberately — a
// broker isn't picking a property-submission role (owner/tenant/helper),
// so folding a fourth card into that grid would misrepresent what's being
// chosen. Two links, not a form: registering happens on /add-broker itself.
export default function BrokerDirectorySection() {
  return (
    <section
      aria-labelledby="broker-directory-heading"
      className="mt-16 rounded-2xl bg-surface p-6 sm:p-8 lg:mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-md">
          <h2
            id="broker-directory-heading"
            className="text-xl font-medium tracking-[-0.02em] text-foreground sm:text-2xl"
          >
            Looking for a broker, or are one?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Registered by brokers themselves, not verified by RentalIntel —
            same honest-by-default approach as everything else here.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/brokers"
            className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
          >
            Browse brokers
          </Link>
          <Link
            href="/add-broker"
            className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            List yourself
          </Link>
        </div>
      </div>
    </section>
  );
}
