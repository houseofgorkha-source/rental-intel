import Link from "next/link";

// The status badge and empty state shared by every list-of-my-things surface:
// the account sections and the admin moderation queues. They were written for
// the account area first and moved here unchanged when admin needed the same
// two pieces — a moderation queue that badged status differently from the
// contributor's own view of the same record would be its own kind of bug.

export type Tone = "pending" | "success" | "danger" | "neutral";

const toneClass: Record<Tone, string> = {
  pending: "bg-warning/10 text-warning ring-warning/30",
  success: "bg-success/10 text-success ring-success/30",
  danger: "bg-danger/10 text-danger ring-danger/30",
  neutral: "bg-surface-raised text-muted ring-border-subtle",
};

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
