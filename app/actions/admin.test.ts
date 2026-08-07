import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests cover what the database cannot: the product rules layered on
// top of the RLS policies — which target states a decision may move a record
// to, and that a rejection carries an explanation. The authorization itself
// is enforced by RLS and column grants and is verified against a real
// Postgres, not here.

const getUser = vi.fn();
const adminLookup = vi.fn();
const propertiesUpdate = vi.fn();
const propertiesResult = vi.fn();
const verificationsUpdate = vi.fn();
const verificationsResult = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser }, from }),
}));

const { moderateProperty, moderateVerification } = await import("./admin");

beforeEach(() => {
  vi.clearAllMocks();

  getUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
  adminLookup.mockResolvedValue({ data: { user_id: "admin-1" }, error: null });
  propertiesResult.mockResolvedValue({ data: [{ slug: "a-flat", status: "published" }], error: null });
  verificationsResult.mockResolvedValue({ data: [{ id: "v-1", status: "verified" }], error: null });

  from.mockImplementation((table: string) => {
    if (table === "admin_users") {
      return { select: () => ({ eq: () => ({ maybeSingle: adminLookup }) }) };
    }
    if (table === "properties") {
      return {
        update: (values: unknown) => {
          propertiesUpdate(values);
          return { eq: () => ({ select: propertiesResult }) };
        },
      };
    }
    if (table === "review_verifications") {
      return {
        update: (values: unknown) => {
          verificationsUpdate(values);
          return { eq: () => ({ select: verificationsResult }) };
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
});

function form(entries: Record<string, string>) {
  const formData = new FormData();
  Object.entries(entries).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("moderateProperty", () => {
  it("refuses a decision that is not publish or reject", async () => {
    const result = await moderateProperty(form({ slug: "a-flat", decision: "pending" }));

    expect(result).toEqual({ error: "Unknown moderation decision." });
    expect(propertiesUpdate).not.toHaveBeenCalled();
  });

  it("refuses when no property is named", async () => {
    const result = await moderateProperty(form({ decision: "published" }));

    expect(result).toEqual({ error: "Missing property." });
    expect(propertiesUpdate).not.toHaveBeenCalled();
  });

  it("refuses an authenticated non-administrator", async () => {
    adminLookup.mockResolvedValue({ data: null, error: null });

    const result = await moderateProperty(form({ slug: "a-flat", decision: "published" }));

    expect(result).toEqual({ error: "You don't have access to moderation." });
    expect(propertiesUpdate).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await moderateProperty(form({ slug: "a-flat", decision: "published" }));

    expect(result).toEqual({ error: "Please sign in to continue." });
    expect(propertiesUpdate).not.toHaveBeenCalled();
  });

  it("writes only the status column", async () => {
    const result = await moderateProperty(form({ slug: "a-flat", decision: "published" }));

    expect(result).toEqual({ success: true });
    expect(propertiesUpdate).toHaveBeenCalledWith({ status: "published" });
  });

  // RLS filters rather than errors, so "no rows came back" is the shape a
  // refusal actually arrives in. It must not be reported as success.
  it("reports a refusal when the policy matched no rows", async () => {
    propertiesResult.mockResolvedValue({ data: [], error: null });

    const result = await moderateProperty(form({ slug: "a-flat", decision: "rejected" }));

    expect(result).toEqual({ error: "That property could not be updated." });
  });
});

describe("moderateVerification", () => {
  it("refuses a rejection with no reason for the contributor", async () => {
    const result = await moderateVerification(form({ id: "v-1", decision: "rejected" }));

    expect(result).toEqual({
      error: "Add a short reason so the contributor knows what to fix.",
    });
    expect(verificationsUpdate).not.toHaveBeenCalled();
  });

  it("records who decided and when, and clears any earlier reason", async () => {
    const result = await moderateVerification(form({ id: "v-1", decision: "verified" }));

    expect(result).toEqual({ success: true });
    expect(verificationsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "verified",
        reviewed_by: "admin-1",
        rejection_reason: null,
      }),
    );
  });

  // The linked review's verification_status is propagated by the existing
  // SECURITY DEFINER trigger. An administrator holds no UPDATE privilege on
  // `reviews`, and this action must never try to use one.
  it("never touches the reviews table", async () => {
    await moderateVerification(
      form({ id: "v-1", decision: "rejected", rejectionReason: "Receipt has no address." }),
    );

    expect(from).not.toHaveBeenCalledWith("reviews");
    expect(verificationsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rejection_reason: "Receipt has no address." }),
    );
  });
});
