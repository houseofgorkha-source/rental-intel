type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export type UploadValidationConfig = {
  maxFileCount: number;
  maxFileSize: number;
  maxTotalSize: number;
  allowedTypes: string[];
};

export type UploadValidationMessages = {
  tooManyFiles: string;
  invalidFile: string;
  totalTooLarge: string;
};

// Stateless and reusable: pure function, no I/O — just checks a list of
// files against the given limits and returns the first matching message.
export function validateUploadFiles(
  files: File[],
  config: UploadValidationConfig,
  messages: UploadValidationMessages,
): string | null {
  if (files.length > config.maxFileCount) {
    return messages.tooManyFiles;
  }

  if (
    files.some(
      (file) =>
        !config.allowedTypes.includes(file.type) || file.size > config.maxFileSize,
    )
  ) {
    return messages.invalidFile;
  }

  if (files.reduce((total, file) => total + file.size, 0) > config.maxTotalSize) {
    return messages.totalTooLarge;
  }

  return null;
}

// Safe, validated extension for a storage object key: only lowercase
// alphanumeric characters are accepted (rejects path separators, "..", and
// other unexpected characters), falling back to "jpg" for anything else.
export function getFileExtension(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

const FILE_SIGNATURES: { type: string; bytes: number[]; offset?: number }[] = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"; "WEBP" checked separately below
  { type: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
];

// Verifies a file's actual leading bytes match its declared MIME type,
// rather than trusting the client-supplied File.type alone. Covers exactly
// the types this app allows to upload (JPEG, PNG, WebP, PDF) — all have
// short, well-known signatures, so no new dependency is needed.
export async function verifyFileSignature(file: File): Promise<boolean> {
  const signature = FILE_SIGNATURES.find((entry) => entry.type === file.type);
  if (!signature) return false;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matchesBytes = signature.bytes.every((byte, index) => header[index] === byte);
  if (!matchesBytes) return false;

  if (file.type === "image/webp") {
    const webpMarker = String.fromCharCode(...header.slice(8, 12));
    return webpMarker === "WEBP";
  }

  return true;
}

// Best-effort only. Cleanup failures are swallowed here and never thrown, so
// they can never mask the original upload/database error that triggered the
// cleanup in the first place — the caller has already decided what error to
// return before calling this.
export async function cleanUpFailedUpload(
  supabase: SupabaseServerClient,
  params: {
    bucket: string;
    uploadedPaths: string[];
    table: string;
    rowId: string;
  },
): Promise<void> {
  try {
    if (params.uploadedPaths.length) {
      await supabase.storage.from(params.bucket).remove(params.uploadedPaths);
    }
    await supabase.from(params.table).delete().eq("id", params.rowId);
  } catch {
    // Intentionally ignored — see function comment above.
  }
}
