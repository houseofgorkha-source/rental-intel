"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cleanUpFailedUpload, getFileExtension, validateUploadFiles, verifyFileSignature } from "@/lib/uploads";

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

  const validationError = validateUploadFiles(
    documents.map((document) => document.file),
    {
      maxFileCount,
      maxFileSize,
      maxTotalSize,
      allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
    },
    {
      tooManyFiles: "You can upload up to 4 documents.",
      invalidFile: "Documents must be PDF, JPG, or PNG files up to 5 MB.",
      totalTooLarge: "Total document upload size must be 15 MB or less.",
    },
  );
  if (validationError) return { error: validationError };

  const signaturesValid = await Promise.all(
    documents.map((document) => verifyFileSignature(document.file)),
  );
  if (signaturesValid.some((valid) => !valid)) {
    return { error: "Documents must be PDF, JPG, or PNG files up to 5 MB." };
  }

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
  const cleanUp = () =>
    cleanUpFailedUpload(supabase, {
      bucket: "verification-documents",
      uploadedPaths,
      table: "review_verifications",
      rowId: verification.id,
    });

  for (const { documentType, file } of documents) {
    const path = `review-verifications/${user.id}/${verification.id}/${documentType}-${crypto.randomUUID()}.${getFileExtension(file)}`;
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
