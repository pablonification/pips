# 3. Every API route is described with zod, and the web client is generated from the description

Status: accepted.

## Context
The web app calls the API a lot. Hand-written `fetch` calls would let the two drift apart without anyone noticing
until a screen broke.

## Decision
- Each route is described in `apps/api/src/routes/*.route.ts` with zod (a library that checks data): the address,
  what it accepts and what it answers. The data's own shapes are in `apps/api/src/types/`. The handler is in
  `apps/api/src/controllers/`.
- The API's description (an OpenAPI document) is built from those files without a server or a database:
  `apps/api/scripts/openapi.ts`.
- The web app's client in `apps/web/src/api/generated/` is generated from that document with
  `pnpm --filter web api`. Nobody edits it by hand.
- Requests are checked against the description when they arrive (a bad request gets a 400). Answers are not checked
  when they leave: TypeScript compares a handler's answer with its route while the code is built, and nothing looks
  at it while the server runs.

## What else was possible
- Hand-written `fetch` calls: no generation step, but nothing ties the two sides together.
- tRPC: types shared directly with no generation step, but it ties the API to TypeScript clients and replaces the
  routes everything else was built around.

## What it costs
- One route is three files (route, types, controller). Adding a field means touching all three.
- After changing the API, someone must run `pnpm --filter web api` and commit the result. No CI step checks that
  they did, so a stale client can be merged.
- A handler can still answer something its route does not describe (an empty list where the description promises
  something else, say), and the generated client trusts the description rather than the answer. A real browser
  against the real API is the only place that shows it.

## When to revisit
When forgetting the generation step has caused a bug or two. A CI step that regenerates the client and fails on any
difference would remove the risk.
