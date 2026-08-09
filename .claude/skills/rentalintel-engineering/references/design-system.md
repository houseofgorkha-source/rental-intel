# Design system

Full detail: CLAUDE.md §9–§10. **This is an unresolved Open Question in CLAUDE.md, not a settled system** — read this as "here's the current state," not "here's the rule."

## Two (really three) palettes currently coexist

- **Slate palette** — `slate-950`/`slate-200`, sharp/minimal. Used in `PropertyDiscovery`, `PropertyGallery`, the property detail page, and most components built in later sessions.
- **Gray/blue/rounded palette** — older, emoji-heavy headers. Used in `LoginForm`, `SignupForm`, `ReviewForm`, `ReviewCard`, `AuthHeader`, and — as of the most recent work — `ContactPreferenceFields.tsx` (`text-gray-900`/`border-gray-200`/`bg-gray-50`).
- **A third, unrelated color**: `#1B4332` (dark green) as a focus ring, originally only on `InputField.tsx` (flagged in CLAUDE.md §9/§11 as a deviation) and now *also* present in `components/shared/SelectField.tsx` (`focus:border-[#1B4332]`, `focus:ring-green-100`) — a new file that inherited the old deviation rather than adopting the newer slate/blue system.

## The documented brand spec (not fully adopted)

Per `RentalIntel_Master_Context_v1.md`: background `#FFFFFF`, text `#111827`, accent blue `#2563EB`. Normal actions are white/outlined buttons that go blue on hover; high-impact actions are solid blue.

## Current interactive-accent convention (recent sessions, not yet ratified)

Homepage hero, property cards, and several newer components use `blue-600` (`#2563EB`) as a restrained interactive/status accent layered on the slate structural base: headline emphasis, active toolbar-chip state, search-bar focus ring, card hover states. Structural chrome (cards, panels, dividers) stays slate. The "Available for rent" badge deliberately uses **emerald**, not blue, so status color doesn't compete with the interactive accent.

## What this means for new work

- New components should follow the **slate + blue-600 accent** convention (the newer direction), not introduce a fourth variant and not reach for `#1B4332`/gray unless extending an already-gray file.
- Don't "fix" the older gray/emoji components as a side effect of an unrelated task — CLAUDE.md §16 says don't restructure without approval, and the palette question is explicitly still open.
- If a task requires touching `SelectField.tsx` or `ContactPreferenceFields.tsx`, note that they're currently off the newer palette — flag it rather than silently leaving it inconsistent or silently "fixing" it outside the task's actual scope.

## Homepage layout template (CLAUDE.md §10)

The homepage hero's two-column pattern — a `rounded-2xl`, `#f6f6f4`-tinted panel (no borders) against the page's `#fbfbfa` background, pixel-aligned to the opposite column's text — is the stated template for future homepage sections, alternating which side carries the tinted panel. Not yet built beyond the hero; start from this if asked to add a homepage section rather than inventing a new layout language.
