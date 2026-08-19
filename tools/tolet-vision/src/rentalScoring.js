// Pure text-scoring/extraction logic — no I/O. Kept separate so it can be
// unit-tested or re-tuned without touching the OCR/crawler plumbing.

// (?<!\d) / (?!\d) instead of \b at the boundaries: \b treats "+" as a
// non-word char, which would (wrongly) allow a match to start mid-way
// through a longer run of digits right after a "+"; a same-length lookaround
// against "is the adjacent character a digit" is what we actually mean, and
// it also rejects matching a spurious 10-digit window out of an 11-digit
// toll-free number like "1800 210 3311" (helpline numbers, not mobiles,
// were showing up as false-positive phone matches before this).
const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;
const BHK_RE = /\b([1-9])\s?BHK\b/i;
const RK_RE = /\b([1-9])\s?RK\b/i;
const RENT_AMOUNT_RE = /(?:₹|rs\.?|inr)\s?[\d,]{3,7}|\b\d{4,6}\s?(?:\/-|per\s?month|pm)\b/i;
const TO_LET_RE = /\bTO\s?-?\s?LET\b/i;
const FOR_RENT_RE = /\bFOR\s?RENT\b/i;
const RENT_WORD_RE = /\bRENT\b/i;
// Negative lookbehind on BROKERS? so "No Broker" (a disclaimer, not an
// agency name) isn't misread as agency evidence — see CONTACT_ROLE_RE for
// where "No Broker" actually gets surfaced.
const BROKER_RE = /\b(REALTY|PROPERT(?:Y|IES)|ASSOCIATES?|ESTATES?|(?<!NO\s)BROKERS?|CONSULTANTS?|BUILDERS?)\b/i;

// Additional, purely-extractive patterns — these only ever surface text the
// board itself contains. None of them classify or infer anything the board
// doesn't literally state (e.g. no guessing "owner" vs "broker" from the
// absence of a keyword — see CONTACT_ROLE_RE below, which only reports
// words actually present).
const PROPERTY_NAME_RE = /\b[A-Z][A-Za-z]*\s*(APARTMENTS?|RESIDENCY|VILLAS?|ENCLAVE|TOWERS?|HOMES?|COMPLEX|PARK|GARDENS?|HEIGHTS|PALACE|CHAMBERS|PLAZA)\b/i;
const ADDRESS_LINE_RE = /\b(ROAD|STREET|\bST\b|MAIN\s?ROAD|CROSS|LAYOUT|NAGAR|BLOCK|SECTOR|NEAR\b|OPP\.?|COLONY|EXTN?\.?|PHASE|CIRCLE|JUNCTION)\b/i;
const CONTACT_ROLE_RE = /\b(NO\s*BROKER\S*|DIRECT\s*OWNER|OWNER|BROKER|AGENT|CONTACT)\b/gi;
const CONTACT_ROLE_TEST_RE = /\b(NO\s*BROKER\S*|DIRECT\s*OWNER|OWNER|BROKER|AGENT|CONTACT)\b/i; // non-global: safe for repeated .test()

function cleanForPhoneMatch(line) {
  // OCR frequently breaks a single phone number across internal spaces
  // ("98451 23456"). Scoped to one line only (see extractPhones) — collapsing
  // whitespace across line breaks is what let digits from two unrelated
  // numbers on separate lines get spliced into one fabricated number.
  return line.replace(/[\s-]{1,3}(?=\d)/g, "");
}

function splitLines(text) {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function dedupe(arr) {
  return [...new Set(arr)];
}

// Extracts phone numbers one OCR line at a time, never across a line break.
// A single real phone number is (almost) always OCR'd as one line; two
// separate numbers on separate lines must never be concatenated into a
// number that doesn't actually exist on the board.
function extractPhones(text) {
  const found = [];
  for (const line of splitLines(text)) {
    const cleaned = cleanForPhoneMatch(line);
    const matches = cleaned.match(PHONE_RE) ?? [];
    found.push(...matches);
  }
  return dedupe(found);
}

const RENTAL_SIGNALS = new Set(["TO_LET", "FOR_RENT", "RENT", "BHK"]);

// A phone number alone is not evidence of a rental board — plenty of
// unrelated signage (cement ads, shop numbers, sale-project banners) has a
// legible phone number too. Call sites must require this alongside their
// score threshold before treating something as a to-let candidate.
export function hasRentalSignal(signals) {
  return signals.some((s) => RENTAL_SIGNALS.has(s));
}

export function extractAndScore(rawText) {
  const text = (rawText || "").trim();
  const signals = [];
  let score = 0;

  const toLet = TO_LET_RE.test(text);
  const forRent = FOR_RENT_RE.test(text);
  if (toLet) {
    score += 40;
    signals.push("TO_LET");
  }
  if (forRent) {
    score += 40;
    signals.push("FOR_RENT");
  }
  if (!toLet && !forRent && RENT_WORD_RE.test(text)) {
    score += 25;
    signals.push("RENT");
  }

  const bhkMatch = text.match(BHK_RE) ?? text.match(RK_RE);
  const bhk = bhkMatch ? Number(bhkMatch[1]) : null;
  if (bhk) {
    score += 15;
    signals.push("BHK");
  }

  const allPhones = extractPhones(text);
  const phone = allPhones[0] ?? null;
  if (phone) {
    score += 15;
    signals.push("PHONE");
  }

  const rentMatch = text.match(RENT_AMOUNT_RE);
  const rent = rentMatch ? rentMatch[0] : null;
  if (rent) {
    score += 10;
    signals.push("RENT_AMOUNT");
  }

  const brokerMatch = text.match(BROKER_RE);
  const broker = brokerMatch ? brokerMatch[0] : null;
  if (broker) {
    score += 10;
    signals.push("BROKER");
  }

  // Everything below is purely extractive (no additional scoring weight) —
  // it surfaces more of what a board says without changing candidate
  // detection/thresholds, which are governed by the signals above.
  const lines = splitLines(text);
  const propertyNameMatch = text.match(PROPERTY_NAME_RE);
  const propertyName = propertyNameMatch ? propertyNameMatch[0].trim() : null;

  const addressLines = dedupe(lines.filter((l) => ADDRESS_LINE_RE.test(l)));
  const addressHints = addressLines.length ? addressLines : null;

  // Distinct from `broker` (the bare keyword used for scoring above):
  // agencyName keeps the full line the keyword appeared in, which is more
  // useful for review than just "REALTY".
  const agencyLine = brokerMatch ? lines.find((l) => BROKER_RE.test(l)) : null;
  const agencyName = agencyLine ?? broker;

  // Explicit, literal role words only — never inferred. A board that says
  // nothing about who's advertising yields contactHints: null, not a guess.
  const contactHints = dedupe([...text.matchAll(CONTACT_ROLE_RE)].map((m) => m[0].trim()));

  // Lines not already accounted for by any of the fields above, kept
  // verbatim for manual review — this is the "other useful text" catch-all,
  // not a new classification.
  const claimedLines = new Set([
    ...(bhkMatch ? [bhkMatch[0]] : []),
    ...(rentMatch ? [rentMatch[0]] : []),
    ...addressLines,
    ...(agencyLine ? [agencyLine] : []),
    ...(propertyNameMatch ? [propertyNameMatch[0]] : []),
  ]);
  const otherText = lines.filter(
    (l) =>
      !TO_LET_RE.test(l) &&
      !FOR_RENT_RE.test(l) &&
      !allPhones.some((p) => l.replace(/[\s-]/g, "").includes(p)) &&
      !CONTACT_ROLE_TEST_RE.test(l) &&
      ![...claimedLines].some((claimed) => l.includes(claimed))
  );

  return {
    rawText: text,
    score,
    signals,
    phone,
    phones: allPhones.length ? allPhones : null,
    bhk,
    rent,
    broker,
    propertyName,
    addressHints,
    agencyName,
    contactHints: contactHints.length ? contactHints : null,
    otherText: otherText.length ? otherText : null,
  };
}
