// Immutable session ID generation. Format: PROVIDER-STRATEGY-TIMESTAMP-RAND
// e.g. OLA-HYBRID-20260820T003000Z-a1b2c3. Timestamp + random suffix
// guarantees uniqueness even for two sessions started in the same
// millisecond; the human-readable provider/strategy prefix is what makes
// a directory listing self-explanatory without opening manifest.json.
import { randomBytes } from "node:crypto";

export function generateSessionId(provider, strategy) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const rand = randomBytes(3).toString("hex");
  return `${provider.toUpperCase()}-${strategy.toUpperCase()}-${ts}-${rand}`;
}

// For sessions synthesized during migration of pre-archive data, where
// the original run has no real session ID — deterministic (not random)
// so re-running the migration produces the same ID for the same legacy
// run rather than creating duplicates.
export function legacySessionId(provider, strategy, legacyRunTag) {
  const safeTag = legacyRunTag.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${provider.toUpperCase()}-LEGACY-${strategy.toUpperCase()}-${safeTag}`;
}
