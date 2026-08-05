import { describe, expect, it, vi } from "vitest";
import { cleanUpFailedUpload, validateUploadFiles } from "./uploads";
import type { UploadValidationConfig, UploadValidationMessages } from "./uploads";

function makeFile(type: string, size: number): File {
  return { type, size } as File;
}

const config: UploadValidationConfig = {
  maxFileCount: 2,
  maxFileSize: 100,
  maxTotalSize: 150,
  allowedTypes: ["image/jpeg", "image/png"],
};

const messages: UploadValidationMessages = {
  tooManyFiles: "too many",
  invalidFile: "invalid",
  totalTooLarge: "too large",
};

describe("validateUploadFiles", () => {
  it("returns null when files are within all limits", () => {
    const files = [makeFile("image/jpeg", 50), makeFile("image/png", 50)];
    expect(validateUploadFiles(files, config, messages)).toBeNull();
  });

  it("returns the too-many-files message when the count limit is exceeded", () => {
    const files = [
      makeFile("image/jpeg", 10),
      makeFile("image/jpeg", 10),
      makeFile("image/jpeg", 10),
    ];
    expect(validateUploadFiles(files, config, messages)).toBe("too many");
  });

  it("returns the invalid-file message for a disallowed type", () => {
    const files = [makeFile("application/pdf", 10)];
    expect(validateUploadFiles(files, config, messages)).toBe("invalid");
  });

  it("returns the invalid-file message for a single oversized file", () => {
    const files = [makeFile("image/jpeg", 101)];
    expect(validateUploadFiles(files, config, messages)).toBe("invalid");
  });

  it("returns the total-too-large message when combined size exceeds the cap", () => {
    const files = [makeFile("image/jpeg", 90), makeFile("image/png", 90)];
    expect(validateUploadFiles(files, config, messages)).toBe("too large");
  });

  it("returns null for an empty file list", () => {
    expect(validateUploadFiles([], config, messages)).toBeNull();
  });
});

describe("cleanUpFailedUpload", () => {
  function makeSupabaseMock({
    removeImpl,
    deleteImpl,
  }: {
    removeImpl?: () => Promise<unknown>;
    deleteImpl?: () => Promise<unknown>;
  } = {}) {
    const remove = vi.fn(removeImpl ?? (() => Promise.resolve({ error: null })));
    const eq = vi.fn(deleteImpl ?? (() => Promise.resolve({ error: null })));
    const del = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ remove }));
    const table = vi.fn(() => ({ delete: del }));

    return {
      storage: { from },
      from: table,
      remove,
      del,
      eq,
    };
  }

  it("removes storage objects and deletes the row on the happy path", async () => {
    const supabase = makeSupabaseMock();

    await cleanUpFailedUpload(supabase as never, {
      bucket: "property-images",
      uploadedPaths: ["a.jpg", "b.jpg"],
      table: "properties",
      rowId: "row-1",
    });

    expect(supabase.storage.from).toHaveBeenCalledWith("property-images");
    expect(supabase.remove).toHaveBeenCalledWith(["a.jpg", "b.jpg"]);
    expect(supabase.from).toHaveBeenCalledWith("properties");
    expect(supabase.eq).toHaveBeenCalledWith("id", "row-1");
  });

  it("skips the storage call when there are no uploaded paths", async () => {
    const supabase = makeSupabaseMock();

    await cleanUpFailedUpload(supabase as never, {
      bucket: "property-images",
      uploadedPaths: [],
      table: "properties",
      rowId: "row-1",
    });

    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.eq).toHaveBeenCalledWith("id", "row-1");
  });

  it("never throws when the storage removal rejects", async () => {
    const supabase = makeSupabaseMock({
      removeImpl: () => Promise.reject(new Error("storage down")),
    });

    await expect(
      cleanUpFailedUpload(supabase as never, {
        bucket: "property-images",
        uploadedPaths: ["a.jpg"],
        table: "properties",
        rowId: "row-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("never throws when the row delete rejects", async () => {
    const supabase = makeSupabaseMock({
      deleteImpl: () => Promise.reject(new Error("db down")),
    });

    await expect(
      cleanUpFailedUpload(supabase as never, {
        bucket: "property-images",
        uploadedPaths: ["a.jpg"],
        table: "properties",
        rowId: "row-1",
      }),
    ).resolves.toBeUndefined();
  });
});
