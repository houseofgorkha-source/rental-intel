import { describe, expect, it } from "vitest";
import { formatVerifiedVia } from "./verification";

describe("formatVerifiedVia", () => {
  it("returns null for no document types", () => {
    expect(formatVerifiedVia([])).toBeNull();
  });

  it("returns null when nothing recognisable is present", () => {
    expect(formatVerifiedVia(["something_unknown"])).toBeNull();
  });

  it("formats a single document type", () => {
    expect(formatVerifiedVia(["rental_agreement"])).toBe("Rental agreement");
  });

  it("joins two document types with 'and'", () => {
    expect(formatVerifiedVia(["rental_agreement", "rent_receipt"])).toBe(
      "Rental agreement and Rent receipt",
    );
  });

  it("joins three or more document types with commas and a trailing 'and'", () => {
    expect(
      formatVerifiedVia(["rental_agreement", "rent_receipt", "electricity_bill"]),
    ).toBe("Rental agreement, Rent receipt, and Electricity bill");
  });

  it("deduplicates repeated document types", () => {
    expect(formatVerifiedVia(["rental_agreement", "rental_agreement"])).toBe(
      "Rental agreement",
    );
  });

  it("ignores unrecognised entries mixed in with real ones", () => {
    expect(formatVerifiedVia(["rental_agreement", "made_up_type"])).toBe(
      "Rental agreement",
    );
  });
});
