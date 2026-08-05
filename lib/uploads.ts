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
