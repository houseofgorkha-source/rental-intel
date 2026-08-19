import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractAndScore } from "./rentalScoring.js";

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
