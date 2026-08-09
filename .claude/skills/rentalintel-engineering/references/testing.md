# Testing

Full detail: CLAUDE.md §6. This is the quick-lookup version.

## What's here

- **Vitest** (`npm test` = `vitest run`, Node environment, `vitest.config.mts`). No integration/E2E runner is configured in `package.json` — browser-driven verification is done ad hoc with the `playwright` package (see the `webapp-testing` skill), not wired into `npm test`.
- **No `@testing-library/react`** or component-render testing present — the existing suite tests pure functions and Server Action logic against a mocked Supabase client, not rendered React output.

## Current test files

| File | Covers |
|---|---|
| `app/actions/admin.test.ts` | `moderateProperty`/`moderateVerification` — auth gating, mocked Supabase |
| `app/actions/review.test.ts` | The `review` Server Action's RPC mapping, mocked Supabase client |
| `components/property/filterProperties.test.ts` | `filterProperties()` — the single filtering implementation (see `frontend.md`) |
| `lib/area-coordinates.test.ts` | Nearest-city/area lookups |
| `lib/auth.test.ts` | `requireUser()` |
| `lib/cities.test.ts` | City/alias normalization |
| `lib/property-attributes.test.ts` | Asserts the TS enum lists match the Postgres enum labels exactly (see `database.md`'s canonicalization pattern) — reads the migration file directly rather than hardcoding a copy |
| `lib/safe-next-path.test.ts` | Open-redirect guard |
| `lib/uploads.test.ts` | Upload validation |

## Adding tests for new `lib/` or Server Action code

Follow the existing pattern: mock the Supabase client rather than hitting a real database from Vitest. For a new canonical-vocabulary file (like `property-attributes.ts`), mirror `property-attributes.test.ts`'s approach of parsing the migration's enum definition directly, so the test fails loudly if the two ever drift instead of silently testing a stale hardcoded copy.

## Compilation and lint are not behavior proof

`npx tsc --noEmit` and `npx eslint .` catch type errors and lint violations; they say nothing about whether a filter actually filters, a redirect actually lands, or an RLS policy actually blocks the row it's supposed to. For those, either extend the Vitest suite (pure logic, mocked Supabase) or drive the real app with Playwright (see the `webapp-testing` skill) — pick based on whether the thing under test is logic or an actual user-facing flow.

## RLS changes need a real Postgres, not a mock

A migration's RLS/grant behavior cannot be verified by Vitest's mocked client — mocking assumes the policy does what you intended. Verify against a real local Supabase instance (`supabase start`, `supabase db reset`, then assert via `psql`/the REST API as different roles) before treating a new policy as correct. This project's existing migrations were verified this way; don't skip it for a new one on the assumption the SQL "looks right."
