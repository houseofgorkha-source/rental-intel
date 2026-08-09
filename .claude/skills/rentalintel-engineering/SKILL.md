---
name: rentalintel-engineering
description: Project-specific engineering conventions for RentalIntel (Next.js App Router + Supabase). Load this before making ANY code change in this repo — implementing a feature, fixing a bug, touching a migration, editing a Server Action or component. Enforces CLAUDE.md as the authority, inspect-before-change discipline, RLS-as-security-boundary, no duplicate implementations, and flags (never silently resolves) contradictions between code and documentation.
---

# RentalIntel Engineering

RentalIntel is a rental-intelligence platform (Next.js 16 App Router + Supabase Postgres/Auth/Storage). This skill is the project-specific layer on top of general coding practice — it exists because this codebase has explicit, hard-won invariants that are easy to violate without noticing, especially around row-level security and the "one implementation" rules.

## The authority chain

1. **`CLAUDE.md`** (repo root) is the canonical product/architecture reference — read it, or the relevant section, before any non-trivial change. It labels every claim `[Verified Fact]`, `[Documented Product Decision]`, `[Current Working Assumption]`, or `[Open Question]` — respect that distinction. A Current Working Assumption is not a rule; don't enforce it as one.
2. **This skill and its `references/`** summarize CLAUDE.md's conventions for quick lookup during implementation, plus a few patterns CLAUDE.md doesn't (yet) capture. Where this skill and CLAUDE.md disagree, CLAUDE.md wins — treat the mismatch as a bug in this skill and flag it to the user rather than silently picking one.
3. **The code itself** is the ground truth for "what currently exists." CLAUDE.md's own §0 admits repo docs can lag reality; the same is true of this skill. Verify a referenced file/function still exists before relying on it.

## Before changing anything

- **Inspect first.** Find the existing pattern for what you're about to do — a similar Server Action, a similar form, a similar migration — before writing new code. This repo has a documented history of near-identical scaffolding (dropdown open/close logic, status-badge styling) being reimplemented instead of shared; don't add to it.
- **Reuse over duplicate.** `components/shared/` holds reusable primitives (`Button`, `InputField`, `SelectField`, `StatusPill`/`EmptyState` in `StatusPrimitives.tsx`, `SectionNav`). A new form or list view should compose these, not reimplement a button or a pill badge inline. See `references/frontend.md`.
- **One implementation per concern.** Search (`filterProperties()`, `HomeSearch`, `FiltersButton`) and status/nav primitives (`SectionNav`, `StatusPrimitives`) are each defined exactly once and reused everywhere they're needed — including across the account and admin areas, which were deliberately unified rather than given parallel copies. Never introduce a second search/filter engine, a second status-badge system, or a second nav component. See `references/frontend.md` and `references/architecture.md`.
- **Simple, readable code.** No abstraction for a single use site, no speculative parameters, no config knobs for hypothetical future variants. Match the existing file's style rather than introducing a new one.
- **No speculative infrastructure.** Don't build for a roadmap item that isn't the current task. See `references/product-boundaries.md` for what's explicitly deferred or out of scope — check it before adding anything that smells like a new subsystem (notifications, analytics, a second messaging surface, a claims/verification flow beyond what exists).

## Security is not optional context

- **RLS is the real boundary, not the app layer.** Every Server Action in `app/actions/` still does its own `requireUser()` check and its own existence/ownership lookup — but that's UX (a clear error message) and defense-in-depth, not the actual gate. The actual gate is the Postgres policy. If you add a write path, it needs a corresponding RLS policy (or an existing one that already covers it) — don't ship a Server Action whose only protection is "the UI doesn't expose a button for that." See `references/security.md`.
- **Column-scoped grants are load-bearing.** `properties` and `review_verifications` use `revoke ... then grant update (specific, columns)` instead of a blanket table grant, specifically so identity/moderation columns stay unreachable through the Data API even for the row's own creator. Never write a migration with `grant update on all tables in schema public` — it would silently revert this. See `references/database.md` and `references/security.md`.
- **Preserve documented invariants** — property identity immutability, the moderation `status` vs. commercial `is_available` axis staying separate, `submitted_as` being self-declared (not verified, never treated as fraud-proof). These are listed in `references/product-boundaries.md`. If a task seems to require breaking one, stop and ask rather than reinterpreting the invariant.

## Testing

Prove behavior, not just compilation. `npx tsc --noEmit` and `npx vitest run` catch type errors and pure-function regressions; they do not prove a filter actually filters or a redirect actually redirects. For anything touching a form, a filter, an auth-gated page, or a redirect chain, drive it in a real browser — see the `webapp-testing` skill. See `references/testing.md` for what's already covered by the existing Vitest suite so you don't re-test it a different way.

## When code and CLAUDE.md disagree

Don't silently pick a side. Report the contradiction plainly (file/line vs. CLAUDE.md section) and let the user decide whether the doc is stale or the code is a regression. `references/product-boundaries.md` lists contradictions already known as of this skill's creation — check whether a new one you've found is already listed there before re-flagging it as new.

## Reference index

| File | Read when you're touching... |
|---|---|
| `references/architecture.md` | Data flow, request lifecycle, which `lib/` helper owns what |
| `references/frontend.md` | Components, folder placement, shared-component reuse |
| `references/design-system.md` | Colors, typography, the in-progress palette migration |
| `references/backend.md` | Server Actions, `app/actions/`, the `requireUser()` pattern |
| `references/database.md` | Migrations, schema, RLS policies, grants |
| `references/security.md` | Auth, RLS-as-boundary, upload validation, admin gating |
| `references/testing.md` | What's covered by Vitest, how to run it, gaps |
| `references/product-boundaries.md` | What RentalIntel is/isn't, deferred features, known contradictions |
| `references/review-checklist.md` | Final pass before calling a change done |
