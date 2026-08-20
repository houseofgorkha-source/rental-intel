// Provider-neutral imagery boundary. Everything downstream (OCR, tiling,
// scoring, extraction, candidate JSON) depends only on this shape, never on
// a specific provider's response format or ID scheme:
//
//   Imagery Provider -> standardized panorama/observation -> OCR -> extraction -> candidate
//
// A "panorama" returned by any provider's crawlPanoramas() must have:
//   provider     string   e.g. "ola", "google" — which service this observation came from
//   sourceId     string   provider-scoped observation/image identifier.
//                         NOT a property identity — the same physical board seen by two
//                         providers, or re-captured later by the same provider, produces
//                         two different sourceIds. Deduplication/property-matching is a
//                         later pipeline stage's job, not this one's.
//   latitude     number
//   longitude    number
//   bearing      number | null
//   captureDate  string | null   ISO date, if the provider exposes one
//   observedAt   string          ISO timestamp of when *we* fetched it
//   imageBytes   Buffer
//
// Swapping providers (e.g. adding Google) means adding a new
// providers/<name>/ module that exports crawlPanoramas() returning this same
// shape — the OCR/scoring/candidate layers do not change.
import * as olaProvider from "./providers/ola/olaProvider.js";
import * as googleProvider from "./providers/google/googleProvider.js";

export const PROVIDERS = {
  ola: olaProvider,
  // Comparison-test only (see googleComparisonTest.js) — not wired into
  // any discovery pipeline. crawlPanoramas() throws on this provider;
  // callers must use resolvePanoramaAtPoint() instead. See
  // providers/google/googleProvider.js for why.
  google: googleProvider,
};

export function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`[imageryProvider] unknown provider "${name}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return provider;
}
