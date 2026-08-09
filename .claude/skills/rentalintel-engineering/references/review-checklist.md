# Review checklist

Run through this before calling a RentalIntel change done. Drawn from CLAUDE.md §16's workflow plus recurring issues found in past audits of this codebase — not a generic checklist, only things that have actually mattered here.

## Before writing code

- [ ] Did I inspect for an existing pattern (component, Server Action, migration) doing something close to this, rather than writing fresh?
- [ ] Am I about to touch something CLAUDE.md §12 lists as approval-gated (RLS/migrations, the `properties` column grant, auth flow, schema, palette direction, public-vs-gated data)? If so, has that approval actually happened, or does it need to be surfaced first?
- [ ] Does this fit inside `product-boundaries.md`'s scope, or does it edge into something explicitly deferred/excluded?

## While writing code

- [ ] New write path: does it have (a) a `requireUser()`/`requireAdmin()` check, (b) its own ownership/validation lookup, and (c) an actual RLS policy backing it — not just an app-layer check? (`security.md`)
- [ ] New migration touching `properties` or `review_verifications`: does it preserve the column-scoped grant pattern (`revoke` then `grant update (specific columns)`), and does it avoid a blanket `grant update on all tables`? (`database.md`)
- [ ] New enum value or canonical string (configuration, property type, furnishing, contact method, role): updated in *both* the migration and the matching `lib/` constant file, character-for-character? (`database.md`)
- [ ] New form field or filter: does the filter UI's selected state actually reach `filterProperties()`'s query/logic, not just change visually? (This exact bug — a filter chip rendering active state with no effect on results — has happened in this codebase before.)
- [ ] New component: does it reuse `shared/Button`, `shared/InputField`/`SelectField`, `shared/StatusPrimitives`, `shared/SectionNav` where applicable, instead of reimplementing them inline?
- [ ] New visual work: does it follow the slate + blue-600 accent convention rather than the older gray/`#1B4332` system, unless you're deliberately extending an already-gray file? (`design-system.md`)

## Before calling it done

- [ ] Typecheck and existing Vitest suite still pass, and any new pure logic has a test in the same style (mocked Supabase, not a live DB).
- [ ] Anything that's a real user flow (a form submit, a filter, an auth redirect) — did I actually drive it in a browser, not just infer it from reading the code? (`testing.md`, `webapp-testing` skill)
- [ ] Did I touch only the files the task required? (CLAUDE.md §16: "never modify unrelated files")
- [ ] Did I find any place where code and CLAUDE.md disagree? If so, did I report it plainly instead of silently resolving it either direction? (`product-boundaries.md` has the ones already known — check whether yours is new.)
- [ ] Nothing committed or pushed unless the user explicitly asked for that in this task.
