---
name: webapp-testing
description: Toolkit for interacting with and testing the running RentalIntel app using Playwright. Supports verifying frontend behavior, debugging UI/auth flows, and capturing browser screenshots. Adapted from the Anthropic skills repository's webapp-testing skill for this project's Node/Next.js stack (no bundled Python scripts here).
---

# Web Application Testing

RentalIntel is a Node/Next.js project with no Python toolchain, so this is the Node-flavored version of the source skill: use the `playwright` npm package directly rather than `with_server.py`. There are no bundled scripts in this project-local copy — write a small `.mjs`/`.ts` Playwright script per task, run it with `node`, and treat it as disposable scratch.

This tests *behavior*, not just compilation. `npx tsc --noEmit` and `npx vitest run` (see `rentalintel-engineering/references/testing.md`) prove the code typechecks and pure functions behave; they do not prove a click actually filters the results or a redirect actually lands where it should. Use this skill for that gap.

## Decision tree

```
Is the dev server already running (npm run dev, port 3000)?
  No  -> start it (background), wait for it to accept connections, then proceed
  Yes -> reconnaissance-then-action:
         1. page.goto(url, { waitUntil: "load" })
         2. Take a screenshot or read page.locator("body").innerText()
         3. Identify selectors from the rendered state
         4. Execute the action, then re-verify (don't assume success)
```

## Known pitfalls specific to this app (learned the hard way — see prior session transcripts)

- **`waitUntil: "domcontentloaded"` races** ahead of redirects and RSC streaming. Use `"load"`, plus a short explicit wait or `page.waitForFunction(() => location.pathname === "...")` for client-side `router.push()` navigation, which does not fire a `load` event.
- **`networkidle` never resolves** on pages with the MapLibre homepage map — it keeps fetching tiles. Don't wait for it there.
- **CSS `text-transform: uppercase` affects `innerText`** — labels rendered uppercase by Tailwind will read as uppercase text; `.toLowerCase()` any assertion you write against visible copy.
- **Browse `http://localhost:3000`, not `127.0.0.1:3000`** — Next 16 blocks cross-origin dev asset requests between the two, which silently breaks hydration and makes clicks appear to do nothing.
- **Auth in test scripts**: this repo has no test-login UI. Build a `@supabase/ssr`-format session cookie directly (`sb-${hostname.split(".")[0]}-auth-token`, value `"base64-" + base64(JSON session)`) via `context.addCookies()`, using a real user created through the Supabase Admin API — don't try to click through Google OAuth or magic-link email in a script.

## Minimal pattern

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("http://localhost:3000/property", { waitUntil: "load" });
await page.waitForTimeout(1000); // let RSC content settle
await page.screenshot({ path: "scratch.png", fullPage: true });
console.log(await page.locator("body").innerText());
await browser.close();
```

## Reconnaissance-then-action

1. Screenshot or `innerText()` the rendered DOM before guessing selectors.
2. Prefer `getByRole`/`text=` selectors over brittle CSS classes — Tailwind class names change often in this codebase.
3. After every action that should change state (a click, a form submit), re-read the DOM or reload to confirm the change actually happened — don't infer success from the absence of an error.
