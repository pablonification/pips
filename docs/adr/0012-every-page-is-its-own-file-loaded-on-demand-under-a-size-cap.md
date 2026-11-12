# 12. Every page is its own file, loaded on demand, under a size cap

Status: accepted.

## Context

Members open the app on phones with weak connections. A single large JavaScript file would make every first visit slow,
even to a page that needs a tenth of it.

## Decision

- TanStack Router reads one small file per address from `apps/web/src/routes/` and writes `routeTree.gen.ts`. A route
  file names its screen (in `apps/web/src/features/`) and starts its data early.
- Each page's code is a separate file the browser fetches when it is needed. `apps/web/vite.config.ts` groups the shared
  code by hand (`codeSplitting.groups`) so a page does not load code it does not use, and marks the design system's
  components as free of side effects (importing a file does nothing by itself), so the build can drop the ones a page
  doesn't use.
- `apps/web/scripts/budgets.mjs` (limits in `apps/web/scripts/lib/budgets.mjs`) measures a production build: the
  JavaScript each route loads before it first renders (the cap is 205 KiB gzipped), the service worker's offline store
  (1.5 MiB), and the fonts (exactly two files). CI runs it as its own step after the build and fails over the cap. The
  largest route sits just under it: see today's numbers with `pnpm --filter web budgets` after a build.

## What else was possible

- One bundle: simple, but every first visit pays for everything.
- The tool's default splitting with no cap: nothing would notice when a page got heavy.

## What it costs

- The grouping rules in `vite.config.ts` are a block of hand-written rules that few people will understand, and they
  name internal folders. Moving a folder can quietly change what loads first. Only the budget check and the journeys
  that count requests before content would show it, and `apps/web/tests/garis-pure.test.mjs` keeps the design system's
  files free of side effects, which the splitting relies on.
- The cap is above the 150 KiB the budget script was first written for. Most of what every page pays is the shared
  start-up code (React, the router, the data library and the dialog parts of Radix).
- A new page needs an entry in the route table (see 0016) as well as its route file.

## When to revisit

When a page nears the cap, or when first-load times on slow phones become a complaint. The shared start-up code is where
any further saving has to come from.
