import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "./safe-next-path";

describe("getSafeNextPath", () => {
  it("accepts a local relative path", () => {
    expect(getSafeNextPath("/property/abc")).toBe("/property/abc");
  });

  it("accepts the root path", () => {
    expect(getSafeNextPath("/")).toBe("/");
  });

  it("rejects an absolute URL", () => {
    expect(getSafeNextPath("https://evil.com")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(getSafeNextPath("//evil.com")).toBe("/");
  });

  it("rejects a path not starting with a slash", () => {
    expect(getSafeNextPath("evil.com")).toBe("/");
  });

  it("falls back to / for undefined", () => {
    expect(getSafeNextPath(undefined)).toBe("/");
  });

  it("falls back to / for null", () => {
    expect(getSafeNextPath(null)).toBe("/");
  });

  it("falls back to / for an empty string", () => {
    expect(getSafeNextPath("")).toBe("/");
  });
});
