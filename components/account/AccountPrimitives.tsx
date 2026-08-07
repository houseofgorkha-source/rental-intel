import Link from "next/link";

// Shared by the account sections so each one stays a thin query + render,
// rather than four separate re-implementations of the same badge and empty
// state. Status wording matches ContributionStatusCards exactly.

type Tone = "pending" | "success" | "danger" | "neutral";

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

export function propertyStatusTone(status: string): Tone {
  if (status === "published") return "success";
  if (status === "rejected") return "danger";
  return "pending";
}

export function propertyStatusLabel(status: string): string {
  if (status === "published") return "Published";
  if (status === "rejected") return "Not approved";
  return "Pending approval";
}

// How the submitter described their relationship to the property. Shown so a
// contributor can tell their own submissions apart at a glance, and so the
// available actions (owner listings vs. knowledge contributions) are
// self-explanatory rather than arbitrary. Always neutral-toned: this is
// self-declared provenance, not a verified status, and must not read as a
// credential (CLAUDE.md §26).
export function roleLabel(submittedAs: string | null): string {
  if (submittedAs === "owner") return "Owner listing";
  if (submittedAs === "tenant") return "Added by resident";
  if (submittedAs === "helper") return "Added on someone's behalf";
  return "Submitted earlier";
}

export function verificationStatusTone(status: string): Tone {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "pending";
}

export function verificationStatusLabel(status: string): string {
  if (status === "verified") return "Verified tenant";
  if (status === "rejected") return "Not verified";
  return "Pending verification";
}
