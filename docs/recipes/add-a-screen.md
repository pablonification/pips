# Add a screen

A new page under Layanan, with its words, its loading and error states, a unit test and a journey. The steps were
tried on a made-up page, `/layanan/contoh`, that shows one sentence and a list read from the API. Replace `contoh`
with your own name everywhere. To make the page reachable from Layanan, continue with
[add a service to Layanan](add-a-service-to-layanan.md); a page that needs data the API doesn't give yet needs
[an API route](add-an-api-route.md) first.

Copy **Ding Dong** for a list page: `routes/_app/_left-navbar/layanan/dingdong/index.tsx`,
`features/dingdong/DingdongScreen.tsx`, `copy/dingdong.ts` and `e2e/journeys/dingdong.spec.ts`.

## Steps

1. **Make the route file** at `apps/web/src/routes/_app/_left-navbar/layanan/contoh/index.tsx`, like
   `layanan/dingdong/index.tsx`. It only names the screen and starts its data early:
   ```tsx
   export const Route = createFileRoute('/_app/_left-navbar/layanan/dingdong/')({
     loader: () => prefetch(currentCoursesQuery()),
     component: DingdongScreen,
   });
   ```
2. **Let the router learn the new route.** Run `pnpm --filter web routes`: it writes `src/routeTree.gen.ts` from the
   route files and exits. Commit the changed file. Until then the type check fails at your `createFileRoute` line (see
   "What will stop you").
3. **Put the words in a copy module**, `apps/web/src/copy/contoh.ts`, like `copy/dingdong.ts`: one object with the
   page title (`judul`), the sentences and the loading, error and empty messages, in Indonesian, speaking to
   *kamu*. `tests/copy.test.ts` reads every file in `copy/` on its own, so it checks yours with no registration.
4. **Write the screen** at `apps/web/src/features/contoh/ContohScreen.tsx`, like `DingdongScreen.tsx`. Start from
   `DeskHead` and `PageBody` (`~/components/shell/page`), and wrap the list in `Loaded` (`features/layanan-svc/parts`),
   which gives you the skeleton, the error with "Coba lagi" and the offline banner. Show an `EmptyState` when the
   list is empty. Use only Garis components ([design system](../design-system.md)).
   Put logic you want to test in `features/contoh/rules.ts`, a plain function, like `features/dingdong/no-folder.ts`.
5. **Add the page to the route table**, `apps/web/src/lib/shell/routes.ts`, next to its neighbours:
   ```ts
   '/layanan/dingdong': {
     title: svc('dingdong'),
     parent: '/layanan',
   },
   ```
   Use `title: contoh.judul` (import it from `~/copy/contoh`). `parent` is the page that "back" goes to.
6. **Add the page to the review sweep**, `apps/web/e2e/review/routes.ts`:
   ```ts
   '/layanan/dingdong': { url: '/layanan/dingdong', as: [NADIA] },
   ```
   `as` names who can open the page: `NADIA` (a plain anggota), `RAKA` (pengurus with `akademik` and `admin`) or `BOTH`.
   Name someone who really may see it, or the sweeps fail on a 401.
7. **Write the unit test** for your `rules.ts`, `apps/web/tests/contoh-rules.test.ts`, with `node:test` as
   `tests/layanan-svc.test.ts` does. Run it:
   `pnpm --filter web exec tsx --test tests/contoh-rules.test.ts` (you should see `# pass 1`).
8. **Write one journey**, `apps/web/e2e/journeys/contoh.spec.ts`, copied from `dingdong.spec.ts`: it opens the
   page and checks the sentence, then `strictGates(page, testInfo, 'contoh', 'Layanan')` (the shared quality checks).
   Add the two states that every list has: loading with `api.on('GET /api/…', reply.hang())` and
   `getByRole('status', { name: … })`, and failing with `reply.status(503)`, then "Coba lagi". If your page asks for an
   address the pretend API doesn't answer yet, see step 4 of [add an API route](add-an-api-route.md).
9. **Run the checks.**
   ```bash
   pnpm --filter web check                 # type check and lint, about 40 s
   pnpm --filter web test                  # unit tests, about 20 s; expect "# fail 0"
   pnpm --filter web exec playwright test -c e2e --project=phone-light --project=desktop-dark contoh
   pnpm --filter web exec playwright test -c e2e --project=qa-phone-light qa/errors qa/keyboard.spec qa/screens -g "contoh"
   ```
   The first journey run builds the app, so it is slower; add `E2E_REUSE_BUILD=1` while you only change tests. The
   second journey command runs the sweeps that every page in `review/routes.ts` gets for free: the Tab walk, the error
   states and the fixed rules (four tests, all should pass).
10. **Check the size.** `pnpm build`, then `pnpm --filter web budgets`. Your route should sit near the others (about
    188 KiB) and the last line should say `All within budget.`

## What will stop you

| You skipped | What prints |
| --- | --- |
| Step 2 | `error TS2345: Argument of type '"/_app/_left-navbar/layanan/contoh/"' is not assignable to parameter of type 'keyof FileRoutesByPath'` |
| Step 5 | `error TS2741: Property '"/layanan/contoh"' is missing in type … but required in type 'Record<ShellPath, RouteMeta>'` |
| Step 6 | `tests/review-routes.test.ts: Property '"/layanan/contoh"' is missing in type … but required in type 'Record<Swept, unknown>'` |
| A persona who can't open the page in step 6 | `qa/errors` fails on `Coba lagi` (the page shows an error, not the list) |
| The pretend answer for a new API call | `The mock guard caught requests with no handler: GET /api/…: no handler` |
| A raw colour, an odd text size or an icon library | `pnpm check` fails with a `garis/…` lint rule |

A sentence written inside the component instead of `copy/` is not caught by any check; review it by eye. The title
and the sentences are yours to word, but keep members' service names exactly (see [CONTEXT.md](../../CONTEXT.md)).
