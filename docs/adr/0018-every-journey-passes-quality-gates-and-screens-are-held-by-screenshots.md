# 18. Every journey passes quality gates, and key screens are held by screenshots

Status: accepted.

## Context

A journey can pass while the screen is unreadable, scrolls sideways or cannot be used with a keyboard. And a small
change to shared styles can alter many screens without anyone looking.

## Decision

- **Gates.** Each screen a journey reaches must pass an accessibility scan (no serious or critical problems), have no
  sideways scroll, no text under 12 px and the right page language, and show a visible focus ring at each Tab stop. The
  gates live in `apps/web/e2e/support/audit.ts` and `strict.ts`. They fail the test by default; CI also sets
  `E2E_GATES=strict` on every journey.
- **Checks across every page** (keyboard, error states, roles, zoom, motion, the service worker) are in
  `apps/web/e2e/qa/` and run in CI.
- **Visual references.** Screenshots kept in Git (`apps/web/e2e/visual/`) are compared on every run, and a screen may
  differ by at most 0.1 % of its pixels. They are kept per platform: macOS ones recorded on a laptop with
  `pnpm --filter web e2e:update`, and Linux ones recorded in CI's own container, because CI is the judge and fonts
  render differently on each system. A workflow started by hand does it and commits them to the branch:
  `gh workflow run visual-references.yml -f branch=<your branch>`. Its file lives on the default branch (`main`), which
  is where GitHub runs hand-started workflows from, so you won't find it beside `check.yml` on other branches.

## What else was possible

- Gates on a few pages only: cheaper, but the pages nobody tested are the ones that break.
- References on one platform: simpler, but then CI and a laptop disagree about every screen.
- No pixel checks: nothing would notice a style change that moves things.

## What it costs

- A visual change means recording two sets of pictures, and one of them only in CI. A pull request that changes a screen
  on purpose needs its references updated before CI can pass.
- Pixel comparison fails on harmless differences (a font update, a different Chromium version) and has to be re-recorded
  then.
- Gates catch what a scan can find. They do not replace a person trying the screen with a screen reader.

## When to revisit

When the references are re-recorded often for no real change, or when keeping both platforms costs more than it catches.
Keeping only the Linux set in Git would halve the pictures.
