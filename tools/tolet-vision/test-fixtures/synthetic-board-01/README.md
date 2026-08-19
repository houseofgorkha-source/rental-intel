# Synthetic board 1 — full-field extraction + "No Broker" case

Not from real imagery — hand-written OCR text covering every extraction
field (`rawText`, `phones`, `bhk`, `propertyName`, `addressHints`,
`agencyName`, `contactHints`, `otherText`) in one pass, plus the case that
caught a real bug: a board saying "No Broker" must not be reported as
agency-advertised.

- `input.json` — the synthetic `rawText` fed to `extractAndScore`.
- `expected.json` — the exact expected output.

Regression-checked by `src/rentalScoring.test.js` alongside
`test-fixtures/recall-test-01` (the real board), so a future change to
`rentalScoring.js` that reintroduces the "No Broker" bug, or breaks a real
detection, fails a test instead of going unnoticed.
