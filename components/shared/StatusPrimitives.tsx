import Link from "next/link";

// The status badge and empty state shared by every list-of-my-things surface:
// the account sections and the admin moderation queues. They were written for
// the account area first and moved here unchanged when admin needed the same
// two pieces — a moderation queue that badged status differently from the
// contributor's own view of the same record would be its own kind of bug.

export type Tone = "pending" | "success" | "danger" | "neutral";

const toneClass: Record<Tone, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
