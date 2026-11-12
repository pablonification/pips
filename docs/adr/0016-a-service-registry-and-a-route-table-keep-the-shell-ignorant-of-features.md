# 16. A service registry and a route table keep the shell ignorant of features

Status: accepted.

## Context
Layanan, Beranda's tiles and global search all list the same services. The frame around every page (tab bar, side
rail, top bar, back button) needs each page's title and parent. If each screen drew its own header and every list
were typed by hand, adding a service would mean editing a dozen places.

## Decision
- `apps/web/src/lib/services.ts` is the one list of services: id, the name members know, destination, group, the
  role that unlocks it (if any), search words and the opening and closing times. Layanan, Beranda and search read
  it.
- `apps/web/src/lib/shell/routes.ts` is the one table of pages: title, parent and which of the four tabs a page
  belongs to. Its keys are the generated route paths, so TypeScript refuses to build until a new route has an entry.
- The shell (`apps/web/src/components/shell/`) imports no feature code. Features register extras with it at start
  (`apps/web/src/main.tsx`), for example how to title a page whose title comes from its URL.
- Tests hold the rules: `apps/web/tests/services.test.ts` (names, routes, safe outside links),
  `apps/web/tests/shell.test.ts`, and `apps/web/tests/testi-shell.test.ts` (the shell imports no feature).

## What else was possible
- Each screen drawing its own header, and lists written by hand: fewer concepts, but every change is many edits and
  the lists disagree over time.

## What it costs
- A new page means touching the route file, the route table and sometimes the registry. TypeScript tells you when a
  step is missing.
- "Features register with the shell at start" is indirect. It needs explaining once, and a registration that is
  never called fails quietly until its page opens.
- A service can carry opening and closing times written in the registry itself (Magang SPARTA has a fixed closing
  date). They are a copy of what the server decides, and the two can disagree (see CONTEXT.md, programme window).

## When to revisit
When the table needs more than titles and parents, or when registration at start-up becomes hard to follow. A
registry that is filled from the server would remove the time copies.
