---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults. Ported and condensed from the Anthropic skills repository.
---

# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. Make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.

For RentalIntel specifically: **check `.claude/skills/rentalintel-engineering/references/design-system.md` first.** This project already has a palette in flux (documented as an open question in CLAUDE.md) — extend what exists rather than introducing a third visual language on top of the two already coexisting.

## Ground it in the subject

Name one concrete subject, its audience, and the page's single job before designing. The subject's own world — its materials, instruments, vernacular — is where distinctive choices come from. Build with the real content, never lorem ipsum.

## Design principles

- **The hero is a thesis.** Open with the most characteristic thing in the subject's world — a headline, an image, a live demo, an interactive moment. A big number with a small label and a gradient accent is the template answer; only use it if it's truly the best option.
- **Typography carries the personality.** Pair display and body faces deliberately, not the pairing you'd reach for on any other project. Set a clear type scale with intentional weights and spacing.
- **Structure is information.** Numbering, dividers, and labels should encode something true about the content, not decorate it. Numbered markers (01/02/03) only belong on genuine sequences.
- **Motion, deliberately.** Consider a page-load sequence, scroll reveal, or hover micro-interaction — but restraint is often the stronger choice; excess animation reads as AI-generated.
- **Match complexity to the vision.** Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail.

## Avoid the default clusters

AI-generated design currently clusters around: warm cream + serif + terracotta; near-black + one acid-green/vermilion accent; broadsheet hairline-rule newspaper columns. Legitimate for some briefs, but they're defaults, not choices, when they appear regardless of subject. Where the brief pins down a direction, follow it exactly. Where it doesn't, don't spend that freedom on one of these defaults.

## Process

1. **Brainstorm a design plan**: a compact token system — color (4–6 named hex values), type (2+ roles: a characterful display face used with restraint, a complementary body face, a utility face if needed), layout (one-sentence concept + ASCII wireframe if useful), signature (the one unique element the page will be remembered by).
2. **Critique the plan against the brief** before writing code — if any part reads like the generic default for any similar page, revise it and note what changed.
3. **Build**, deriving every color/type decision from the revised plan. Watch CSS selector specificity — type-based selectors (`.section`) and element-based ones (`.cta`) can silently cancel each other's spacing.
4. **Self-critique**: spend boldness in one place, keep everything else quiet. Build to a quality floor without announcing it — responsive to mobile, visible keyboard focus, `prefers-reduced-motion` respected.

## Writing in design

Words are design material, not decoration. Write from the end user's side of the screen — name things by what people control and recognize, not how the system is built. Active voice; a control says exactly what happens, and the flow keeps that name through completion ("Publish" → "Published"). Errors explain what went wrong and how to fix it, without apologizing or being vague. Specific beats clever.
