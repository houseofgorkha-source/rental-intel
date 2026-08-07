import type { Tone } from "@/components/shared/StatusPrimitives";

// Domain vocabulary shared by the account sections and the admin moderation
// queues: how a property's moderation state, a submitter's declared role and a
// verification decision are worded and coloured. Deliberately one source of
// truth — a contributor and a moderator looking at the same record must read
// the same words for it.
//
// The badge and empty-state components themselves live in
// components/shared/StatusPrimitives.tsx.

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
