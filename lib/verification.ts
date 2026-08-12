// Mirrors the `public.verification_document_type` enum exactly (see
// components/review/VerifyStayForm.tsx, which declares the same list against
// the same enum for the same reason: this is a value from a form, not
// derived, so it has to be checked rather than cast).
export const VERIFICATION_DOCUMENT_TYPES = [
  "rental_agreement",
  "rent_receipt",
  "electricity_bill",
  "other_proof_of_stay",
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export function isVerificationDocumentType(
  value: unknown,
): value is VerificationDocumentType {
  return VERIFICATION_DOCUMENT_TYPES.includes(value as VerificationDocumentType);
}

// Matches the wording already used in app/admin/verifications/[id]/page.tsx,
// so a document type reads the same way whether an admin or a visitor sees
// it.
export const VERIFICATION_DOCUMENT_LABELS: Record<VerificationDocumentType, string> = {
  rental_agreement: "Rental agreement",
  rent_receipt: "Rent receipt",
  electricity_bill: "Electricity bill",
  other_proof_of_stay: "Other proof of stay",
};

// Turns ["rental_agreement", "rent_receipt"] into "Rental agreement and Rent
// receipt" -- what actually backs a "Verified Tenant" badge, not just that
// something does. Returns null when there is nothing to disclose (an
// unverified review, or a verified one with no readable document type),
// rather than an empty or misleading sentence.
export function formatVerifiedVia(documentTypes: string[]): string | null {
  const labels = Array.from(
    new Set(
      documentTypes
        .filter(isVerificationDocumentType)
        .map((type) => VERIFICATION_DOCUMENT_LABELS[type]),
    ),
  );

  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
