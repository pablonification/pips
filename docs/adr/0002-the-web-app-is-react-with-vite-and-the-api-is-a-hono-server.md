# 2. The web app is React with Vite and the API is a separate Hono server

Status: accepted.

## Context
A newcomer will ask why the app is not built on a full-stack framework such as Next.js, where pages and server code
live together. PIPS! began as a React app and a separate API, and members already had it installed on their phones.

## Decision
- `apps/web` is a React single-page app built with Vite, routed with TanStack Router, with server data handled by
  TanStack Query and styled with Tailwind 4.
- `apps/api` is a Hono server on Node with PostgreSQL through Drizzle.
- The two programs only meet through the API's HTTP routes, one live connection for Curhat Yuk! (socket.io) and web
  push (see 0003, 0009 and 0011).
- The tools were kept and brought up to date, not replaced. The current versions are in the two `package.json`
  files.

## What else was possible
- A rewrite on a full-stack framework: one language and one deploy, but every screen and every route rewritten, and
  a new server model for the team to learn.
- A different API framework: no gain big enough to pay for porting every route.

## What it costs
- The two apps are a generation apart in tooling. The web app is on ESLint 10 and TypeScript 6; the API is still on
  ESLint 8 (an older config style), TypeScript 5.4, Drizzle 0.33 and zod 3. A contributor learns two lint setups.
- The web app is a single-page app: it needs JavaScript to show anything, and every page's code has to be kept small
  on purpose (see 0012).

## When to revisit
When the API's old tools block a security update, or when a feature needs server-rendered pages (for example link
previews of announcements for chat apps). Either would justify a bigger change than an upgrade.
