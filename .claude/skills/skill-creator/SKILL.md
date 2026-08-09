---
name: skill-creator
description: Create new project-local skills under .claude/skills/, or modify and improve existing ones. Use when the user wants to capture a repeated workflow as a skill, edit an existing SKILL.md, or improve a skill's triggering description. Condensed from the Anthropic skills repository's skill-creator for local, script-free use.
---

# Skill Creator

A skill for creating and iterating on other skills. This condensed, project-local version keeps the core loop — draft, test, get feedback, improve — without the eval-viewer/benchmarking machinery (no bundled scripts here; use judgment and direct user feedback instead).

## Anatomy of a skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter: name, description (required)
│   └── Markdown instructions
└── Bundled resources (optional)
    ├── scripts/    - executable code for deterministic/repetitive tasks
    ├── references/ - docs loaded into context only as needed
    └── assets/     - files used in output (templates, icons)
```

## Progressive disclosure — the whole point

Three loading levels:
1. **Metadata** (name + description) — always in context, ~100 words.
2. **SKILL.md body** — loaded when the skill triggers, ideally under 500 lines.
3. **Bundled resources** — loaded only when SKILL.md points to them.

Keep SKILL.md lean. If a topic needs more than a paragraph or two, push it to `references/<topic>.md` and link to it with a one-line pointer explaining when to read it. For a skill with multiple domains, one reference file per domain (see `rentalintel-engineering/references/` for a working example) — the model reads only the file relevant to the current task.

## Writing the description

The `description` field is the primary triggering mechanism — Claude decides whether to consult a skill based on it alone, before reading the body. State both what the skill does and the specific contexts that should trigger it. Err slightly toward being "pushy" about when to use it — undertriggering (not consulting a skill that would help) is the more common failure than overtriggering.

## Process for capturing a new skill

1. **Capture intent** — if this conversation already contains the workflow (the user says "turn this into a skill"), extract the steps, tools, and corrections directly from history rather than re-asking. Confirm gaps with the user.
2. **Interview** on edge cases, expected inputs/outputs, and what "done" looks like.
3. **Draft SKILL.md** — name, description, then the instructions. Explain the *why* behind each instruction rather than issuing bare imperatives; a model with context on why something matters generalizes better than one following a rigid rule. Avoid ALL-CAPS MUST/NEVER as a first resort — it's a sign the reasoning wasn't transmitted.
4. **Test it** on 2–3 realistic prompts — the kind of thing a real user would actually type, not an abstracted version.
5. **Get feedback**, generalize from it (don't overfit to the exact test cases), revise, retest.
6. Repeat until the user is satisfied or feedback stops changing.

## Updating an existing skill

Preserve the skill's name and directory. Read the current SKILL.md fully before editing — understand what it's already covering and why before changing it, the same "inspect before changing" discipline this project expects of application code.

## Writing style

Imperative, concise instructions. Prefer explaining reasoning over issuing commands. Keep the skill general enough to cover the class of task, not just the one example that prompted it — but don't invent scope nobody asked for either.
