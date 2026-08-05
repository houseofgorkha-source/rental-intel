"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const documentFields = [
  "rental_agreement",
  "rent_receipt",
  "electricity_bill",
  "other_proof_of_stay",
] as const;

type VerificationResult = { error?: string };
const maxFileSize = 5 * 1024 * 1024;
const maxFileCount = 4;
const maxTotalSize = 15 * 1024 * 1024;

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

  if (documents.length > maxFileCount) return { error: "You can upload up to 4 documents." };

  if (
    documents.some(
      ({ file }) =>
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size > maxFileSize,
    )
  ) {
    return { error: "Documents must be PDF, JPG, or PNG files up to 5 MB." };
  }
  if (documents.reduce((total, { file }) => total + file.size, 0) > maxTotalSize) return { error: "Total document upload size must be 15 MB or less." };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to verify your stay.",
  );
  if (!user) return { error: authFailure };

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
  const uploadedPaths: string[] = [];
  const cleanUp = async () => {
    if (uploadedPaths.length) await supabase.storage.from("verification-documents").remove(uploadedPaths);
    await supabase.from("review_verifications").delete().eq("id", verification.id);
  };

  for (const { documentType, file } of documents) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "file";
    const path = `review-verifications/${user.id}/${verification.id}/${documentType}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("verification-documents")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      await cleanUp();
      return { error: "Unable to upload verification documents. Please try again." };
    }
    uploadedPaths.push(path);
    documentRows.push({ verification_id: verification.id, document_type: documentType, storage_path: path });
  }

  const { error: documentError } = await supabase
    .from("verification_documents")
    .insert(documentRows);
  if (documentError) {
    await cleanUp();
    return { error: "Unable to save verification documents. Please try again." };
  }

  return {};
}
