# Add an API route

A `GET` that answers a small list to a signed-in member, with a role check, a unit test, the regenerated web client and
an answer in the pretend API. The steps were tried on a made-up `GET /contoh` that only members with the `akademik`
role may call. Replace `contoh` with your own name. For a route that writes, the steps are the same; the
role check is written the same way (step 4).

Copy **programme windows** for the shape: `routes/programme-window.route.ts`, `controllers/programme-window.controller.ts`,
`repositories/programme-window.repo.ts`, `types/programme-window.types.ts` and `tests/programme-windows-route.test.ts`.
Copy **competitions** (`controllers/competitions.controller.ts`, `tests/competitions-route.test.ts`) for the role check.
All paths are under `apps/api/` unless they start with `apps/web`. [Architecture](../architecture.md) says what each
folder is for.

## Steps

1. **Describe the data**, `src/types/contoh.types.ts`, with zod from `@hono/zod-openapi`, like
   `types/programme-window.types.ts`:
   ```ts
   export const ListProgrammeWindowsSchema = z
     .object({ windows: z.array(ProgrammeWindowSchema) })
     .openapi('ListProgrammeWindows');
   ```
   Name each shape with `.openapi('Name')`: the web client's types take their names from it. Don't derive an answer from
   a whole table with `createSelectSchema` unless you mean every column (see [add a migration](add-a-migration.md)).
2. **Describe the address**, `src/routes/contoh.route.ts`, with `createRoute` like `routes/programme-window.route.ts`:
   an `operationId` (it becomes the client's method name), a `tags` entry (it becomes the client's service name), the
   `method`, the `path`, a `description`, and the `200` answer and `401` (`errorResponse` from `~/types/responses.type`).
3. **Write the query**, `src/repositories/contoh.repo.ts`: a plain function whose first argument is the database, like
   `getActiveProgrammeWindows(db: Database)` in `repositories/programme-window.repo.ts`.
4. **Write the controller**, `src/controllers/contoh.controller.ts`, in the style of `programme-window.controller.ts`:
   a `ContohDeps` interface of the functions it needs (`WithoutDb<typeof listContoh>`), `createContohRouter(deps = …)`
   with the real ones as the default, and `export const contohRouter = createContohRouter()`. Use `createAuthRouter()`
   from `./router-factory`, which refuses a signed-out request.
   **The role check** wraps the route you register, as `competitions.controller.ts` does, with `getUserRoles` in your
   deps (`WithoutDb<typeof getUserRoles>`):
   ```ts
   competitionsRouter.openapi(
     forRoles(createCompetitionRoute, ['cnc'], deps.getUserRoles),
     async (c) => {
   ```
   It runs before the request is validated. A member without the role gets **401** `{ "error": "Unauthorized" }`, not
   403. A check that depends on the row (only the author, only the room's owner) goes in the handler instead.
5. **Register the router** in `src/controllers/api.controller.ts`: an `import` and one line beside the others,
   `protectedApiRouter.route('/', programmeWindowRouter);`. Anything signed-in goes on `protectedApiRouter`.
   Then **say who may call it**: a row in `src/lib/route-access.ts`, `'GET /api/contoh': { who: ['akademik'] }`
   (or `who: 'member'`, with a `note` for what the handler decides). If it is for named roles, also add your
   `create…Router(fakeDeps())` to the list in `tests/route-access.test.ts`, which then checks the row with requests.
6. **Write the unit test**, `tests/contoh-route.test.ts`, from `programme-windows-route.test.ts`: call
   `usePlaceholderEnv()` in `before`, import the controller after it, and pass fake `deps` to `createContohRouter`.
   `callRouter(router, user, 'GET', '/contoh')` (`tests/support/router.ts`) sends the request with a session. Test at least:
   the member with the role gets the list, and the route is mounted. (`tests/route-access.test.ts` already sends a
   signed-out request and a member without the role, from your row in step 5.) A made-up member's student number
   needs a sequence of 900 or more: `testUser('u1', { nim: '13525901' })`.
   Mounted is checked in the API's description, because an unknown path answers 401 as well:
   ```ts
   const doc = JSON.parse(JSON.stringify(openApiDocument(createApp()))) as {
     paths: object;
   };
   assert.ok('/api/programme-windows' in doc.paths);
   ```
   Run it: `pnpm --filter api exec tsx --test tests/contoh-route.test.ts tests/route-access.test.ts`.
7. **Regenerate the web client** from the repository root: `pnpm --filter web api`. It prints `openapi: 72 paths written…`
   and adds files under `apps/web/src/api/generated/` (a `ContohService.ts`, the models, and lines in `ApiClient.ts`
   and `index.ts`). Commit them. You call it as `api.contoh.listContoh()`, as `queries.ts` calls `api.course.getCurrentUserCourse()`.
8. **Mirror the role in the web app** if the web app shows or hides something by it: a row in
   `apps/web/src/lib/capabilities.ts` and a check in `apps/web/tests/capabilities.test.ts` that reads your row
   (steps 3 and 4 of [add a service to Layanan](add-a-service-to-layanan.md)).
9. **Give the pretend API an answer**, `apps/web/e2e/support/handlers.ts`, once a screen in the web app asks for it:
   ```ts
   'GET /api/category': signedIn(({ db }) =>
     ok<R<CategoryService['getListCategory']>>({ categories: db.categories }),
   ),
   ```
   For a role-only route use `withRole(['akademik'], …)` from the same file, which answers 401 like `forRoles`.
   Import the service type (`ContohService`) at the top. A write has no default: a journey registers its own with
   `api.on('POST /api/…', …)`.
10. **Run the checks.**
    ```bash
    pnpm --filter api check        # type check and lint, about 20 s
    pnpm --filter api test         # every API unit test
    pnpm --filter web check
    pnpm --filter web exec playwright test -c e2e --project=phone-light <the journey that reaches the route>
    ```

## What will stop you

| You skipped | What prints |
| --- | --- |
| Step 5, the router | The unit test `the route is mounted in the app` fails on `'/api/contoh' in doc.paths`, and `tests/route-access.test.ts` says `Remove or fix these rows: GET /api/contoh`. A signed-out `GET` gives 401 either way. |
| Step 5, the row | `tests/route-access.test.ts`: `Add a row for each of these to ROUTE_ACCESS in apps/api/src/lib/route-access.ts … GET /api/contoh` |
| Step 5, the test's list | `tests/route-access.test.ts`: `Give these routes’ controllers a getUserRoles dep and mount them in this test` |
| Step 7 | CI step "The generated API client matches the API": it lists the changed files and `Run 'pnpm --filter web api' and commit apps/web/src/api/generated.` |
| Step 8 | `capabilities.test.ts`: `every capability is checked against the server` and `SERVER[capability] is not a function` |
| Step 9 | The journey that reaches your call: `The mock guard caught requests with no handler: GET /api/contoh: no handler` |
| The role check in step 4 | `tests/route-access.test.ts`: `a member holding every role but the listed ones gets 401 on each role-only route` names your route. |

Anything the route returns reaches the member's phone. Never send who wrote a Curhat message or owns a room, or another
member's private fields ([AGENTS.md](../../AGENTS.md), "Never compromise").
