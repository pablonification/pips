# 22. Each API operation is its own generated file, so a page loads only what it calls

Status: accepted. Changes how decision 3's client is laid out; the way it is generated and checked stays.

## Context

The generated client was one `ApiClient` class that made every service (one class per tag of routes), and the entry
created it. So every page loaded every operation of the API, and each new route made every page heavier. Pengumuman
had reached 204.9 KiB of the 205 KiB cap (decision 12), with the forms builder's routes still to come.

Two facts decide the shape of a fix:

- **A bundler puts a whole file in one chunk.** Tree shaking drops what no page uses, but a function used by one page
  goes wherever its file goes. Route loaders (decision 12) live in the entry and start requests, so a file holding a
  loader's request is in the entry, with every other used function in that file. One class per tag, or one file of
  functions (what `@hey-api/openapi-ts` writes), keeps the problem.
- **A file the bundler thinks runs code is loaded where it is first imported.** An operation imports the shared
  `http` instance, which runs `new` when loaded, so the bundler would evaluate every operation where the entry imports
  their index.

## Decision

- `pnpm --filter web api` still runs openapi-typescript-codegen first (its core: the request function, `ApiError`,
  `CancelablePromise`, the models), then `apps/web/scripts/api-operations.mjs`. That step turns each generated
  service method into its own file, `apps/web/src/api/generated/operations/<operationId>.ts`, with an index, and
  removes the service classes and `ApiClient`, so there is one way to call the API. Nothing in it is edited by hand,
  and CI's check that regenerating changes nothing covers it.
- Every operation calls `http` (`apps/web/src/api/http.ts`): the base URL, credentials, `encodeURIComponent` for path
  parts and the time limit (`timed-request.ts`). Call sites write `import * as api from '~/api/generated/operations'`
  and `api.getInfoById({ infoId })`.
- `apps/web/vite.config.ts` marks the operation files as free of import-time effects, and
  `apps/web/tests/garis-pure.test.mjs` keeps them so.

## What else was possible

- **Move to `@hey-api/openapi-ts`.** Maintained, and it writes functions, but all of them in one file, so the
  same file-in-one-chunk problem; it also changes the error type (`ApiError`), drops cancelable promises and moves the
  time limit into a custom `fetch`. A split step would be needed anyway.
- **One service instance per page** with today's classes: the services loaders use (most of them) would stay in the
  entry, with all their methods.
- **Load loaders' requests on demand** (`import()` in the loader): every page's data would start one round trip later.

## What it costs

- A step of our own on top of the generator: about a hundred lines that read the generator's service files with the
  TypeScript parser. openapi-typescript-codegen is no longer maintained, so its output will not change under us, but
  moving off it means rewriting this step.
- The saving today is small, about 1.3 KiB per page: the whole client was about 2.7 KiB gzipped. What it buys is that a
  new route grows only the pages that call it, and the entry only when a loader prefetches it.
- A feature module a loader imports still brings its other requests into the entry, so a loader's queries can live in
  a file of their own and a feature's sends in another (`components/form/data.ts` and `send.ts`). `sparta-data.ts`
  kept its writes on purpose: they kept React Query's `useMutation` in the entry, which sign-in needs; without them
  it landed in the shared `ui` chunk and sign-in loaded all of it. Magang SPARTA, and with it that file, was removed
  on 2026-11-23; `vite.config.ts` now puts all of React Query in the `app` chunk instead, so no page depends on
  which module happens to keep it in the entry.

## When to revisit

When the generator is replaced, or when a generator can write one file per operation itself.
