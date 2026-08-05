import { describe, expect, it, vi } from "vitest";
import { requireUser } from "./auth";

function makeSupabaseMock(getUserImpl: () => Promise<unknown>) {
  return {
    auth: { getUser: vi.fn(getUserImpl) },
  };
}

describe("requireUser", () => {
  it("returns the user when authenticated", async () => {
    const user = { id: "user-1" };
    const supabase = makeSupabaseMock(() =>
      Promise.resolve({ data: { user }, error: null }),
    );

    const result = await requireUser(supabase as never, "not signed in");

    expect(result).toEqual({ user, error: null });
  });

  it("returns the given error message when getUser errors", async () => {
    const supabase = makeSupabaseMock(() =>
      Promise.resolve({ data: { user: null }, error: new Error("boom") }),
    );

    const result = await requireUser(supabase as never, "not signed in");

    expect(result).toEqual({ user: null, error: "not signed in" });
  });

  it("returns the given error message when there is no user and no error", async () => {
    const supabase = makeSupabaseMock(() =>
      Promise.resolve({ data: { user: null }, error: null }),
    );

    const result = await requireUser(supabase as never, "not signed in");

    expect(result).toEqual({ user: null, error: "not signed in" });
  });
});
