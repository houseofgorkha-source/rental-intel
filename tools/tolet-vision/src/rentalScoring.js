// Pure text-scoring/extraction logic — no I/O. Kept separate so it can be
// unit-tested or re-tuned without touching the OCR/crawler plumbing.

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const BHK_RE = /\b([1-9])\s?BHK\b/i;
const RK_RE = /\b([1-9])\s?RK\b/i;
const RENT_AMOUNT_RE = /(?:₹|rs\.?|inr)\s?[\d,]{3,7}|\b\d{4,6}\s?(?:\/-|per\s?month|pm)\b/i;
const TO_LET_RE = /\bTO\s?-?\s?LET\b/i;
const FOR_RENT_RE = /\bFOR\s?RENT\b/i;
const RENT_WORD_RE = /\bRENT\b/i;
const BROKER_RE = /\b(REALTY|PROPERT(?:Y|IES)|ASSOCIATES?|ESTATES?|BROKERS?|CONSULTANTS?|BUILDERS?)\b/i;

function cleanForPhoneMatch(text) {
  // OCR frequently breaks a phone number across spaces/newlines.
  return text.replace(/[\s-]{1,3}(?=\d)/g, "");
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

  const phoneMatches = cleanForPhoneMatch(text).match(PHONE_RE) ?? [];
  const phone = phoneMatches[0] ?? null;
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

  return { score, signals, phone, bhk, rent, broker };
}
