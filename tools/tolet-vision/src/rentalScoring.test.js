import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "..", "test-fixtures");

function readJson(...parts) {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, ...parts), "utf8"));
}

test("recall-test-01: real board detection is unchanged (regression)", () => {
  const fixture = readJson("recall-test-01", "result.json");
  const result = extractAndScore(fixture.candidate.ocrText);

  assert.equal(result.score, fixture.candidate.score);
  assert.deepEqual(result.signals, fixture.candidate.signals);
  assert.equal(result.phone, fixture.candidate.phone);
  assert.deepEqual(result.phones, [fixture.candidate.phone]);
  // The board never states these — must stay null, not guessed.
  assert.equal(result.bhk, null);
  assert.equal(result.propertyName, null);
  assert.equal(result.addressHints, null);
  assert.equal(result.agencyName, null);
  assert.equal(result.contactHints, null);
});

test("synthetic-board-01: full-field extraction, including the 'No Broker' case", () => {
  const { rawText } = readJson("synthetic-board-01", "input.json");
  const expected = readJson("synthetic-board-01", "expected.json");
  const result = extractAndScore(rawText);

  assert.equal(result.score, expected.score);
  assert.deepEqual(result.signals, expected.signals);
  assert.equal(result.phone, expected.phone);
  assert.deepEqual(result.phones, expected.phones);
  assert.equal(result.bhk, expected.bhk);
  assert.equal(result.rent, expected.rent);
  assert.equal(result.broker, expected.broker);
  assert.equal(result.propertyName, expected.propertyName);
  assert.deepEqual(result.addressHints, expected.addressHints);
  assert.equal(result.agencyName, expected.agencyName);
  assert.deepEqual(result.contactHints, expected.contactHints);
  assert.equal(result.otherText, expected.otherText);
});

test("'No Broker' alone must never surface as an agency name", () => {
  const result = extractAndScore("TO LET\nNo Broker\n9886123456");
  assert.equal(result.broker, null);
  assert.equal(result.agencyName, null);
  assert.ok(result.contactHints.includes("No Broker"));
});

test("a board that states nothing extra yields all-null enrichment fields", () => {
  const result = extractAndScore("FOR RENT\n9886123456");
  assert.equal(result.bhk, null);
  assert.equal(result.rent, null);
  assert.equal(result.broker, null);
  assert.equal(result.propertyName, null);
  assert.equal(result.addressHints, null);
  assert.equal(result.agencyName, null);
  assert.equal(result.contactHints, null);
});

// --- Discovery pilot precision fixes -------------------------------------
// Both cases below are the exact real bugs found in the first Bangalore
// discovery pilot run, not hypotheticals.

test("hasRentalSignal: phone alone is not a rental signal", () => {
  const phoneOnly = extractAndScore("9886123456");
  assert.equal(phoneOnly.signals.includes("PHONE"), true);
  assert.equal(hasRentalSignal(phoneOnly.signals), false);
});

test("hasRentalSignal: TO_LET/FOR_RENT/RENT/BHK each count, with or without a phone", () => {
  assert.equal(hasRentalSignal(extractAndScore("TO LET").signals), true);
  assert.equal(hasRentalSignal(extractAndScore("FOR RENT").signals), true);
  assert.equal(hasRentalSignal(extractAndScore("available for rent, no phone listed").signals), true);
  assert.equal(hasRentalSignal(extractAndScore("2 BHK").signals), true);
});

test("phone extraction: a toll-free helpline is not misread as a mobile number (UltraTech Cement pilot false positive)", () => {
  // Real OCR output from the pilot's UltraTech Cement panorama — the old
  // regex matched a spurious 10-digit window ("8002103311") out of this
  // 11-digit toll-free number.
  const result = extractAndScore("INDIA'S NO.1 CEMENT\nUltraTech CEMENT\nC18002103311\nThe Engineer's Choice");
  assert.equal(result.phone, null);
  assert.equal(result.phones, null);
});

test("phone extraction: digits on separate OCR lines are never concatenated into a fabricated number", () => {
  // Real OCR output from the pilot ("thruko" board): the old code stripped
  // the newline between these two lines and matched a 10-digit window that
  // splices the tail of the first number with the second — a number that
  // never appeared on the board. The fix must not fabricate that number.
  const result = extractAndScore("9845799515\n9900");
  assert.equal(result.phones.includes("7995159900"), false);
  // The real, actually-printed number on its own line should still be found.
  assert.equal(result.phone, "9845799515");
});

test("phone extraction: a second real bug case (9731067383 / 482655 splice)", () => {
  const result = extractAndScore("PG\n9731067383\n482655");
  assert.equal(result.phones.includes("7383482655"), false);
  assert.equal(result.phone, "9731067383");
});

test("phone extraction: a legitimately space-broken single number on one line still works", () => {
  const result = extractAndScore("Contact: 98451 23456");
  assert.equal(result.phone, "9845123456");
});
