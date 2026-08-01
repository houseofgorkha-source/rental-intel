"use server";

import { createClient } from "@/lib/supabase/server";

const documentFields = [
  "rental_agreement",
  "rent_receipt",
  "electricity_bill",
  "other_proof_of_stay",
] as const;

type VerificationResult = { error?: string };

export async function createVerification(
  formData: FormData,
): Promise<VerificationResult> {
  const reviewId = String(formData.get("reviewId") || "");
  const documents = documentFields
    .map((documentType) => ({ documentType, file: formData.get(documentType) }))
    .filter(
      (document): document is { documentType: (typeof documentFields)[number]; file: File } =>
        document.file instanceof File && document.file.size > 0,
    );

  if (!reviewId || documents.length === 0) {
    return { error: "Please choose at least one supporting document." };
  }

  if (
    documents.some(
      ({ file }) =>
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    )
  ) {
    return { error: "Documents must be PDF, JPG, or PNG files up to 5 MB." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in to verify your stay." };

  const { data: verification, error: verificationError } = await supabase
    .from("review_verifications")
    .insert({ review_id: reviewId, created_by: user.id, status: "pending" })
    .select("id")
    .single();

  if (verificationError || !verification) {
    return { error: "Unable to submit verification. It may already be pending review." };
  }

  const documentRows = [] as {
    verification_id: string;
    document_type: (typeof documentFields)[number];
    storage_path: string;
  }[];

  for (const { documentType, file } of documents) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "file";
    const path = `review-verifications/${user.id}/${verification.id}/${documentType}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("verification-documents")
      .upload(path, file, { contentType: file.type });

    if (uploadError) return { error: "Your request was created, but a document could not be uploaded." };
    documentRows.push({ verification_id: verification.id, document_type: documentType, storage_path: path });
  }

  const { error: documentError } = await supabase
    .from("verification_documents")
    .insert(documentRows);
  if (documentError) return { error: "Your request was created, but its documents could not be linked." };

  return {};
}
