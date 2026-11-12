# Add an API route

A `GET` that answers a small list to a signed-in member, with a role check, a unit test, the regenerated web client and
an answer in the pretend API. The steps were tried on a made-up `GET /contoh` that only members with the `akademik`
role may call. Replace `contoh` with your own name. For a route that writes, the steps are the same; the
role check goes before the handler in the same way (step 4).

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
   **The role check** goes on the path *before* the handler, as `competitions.controller.ts` does:
   ```ts
   const cncOnly = roleMiddleware(['cnc'], deps.getUserRoles);
   competitionsRouter.post(createCompetitionRoute.getRoutingPath(), cncOnly);
   competitionsRouter.openapi(createCompetitionRoute, async (c) => {
   ```
   For a `GET` write `router.get(path, middleware)`. A member without the role gets **401** `{ "error": "Unauthorized" }`,
   not 403. A route with no check is open to every member, and no test notices that for you.
5. **Register the router** in `src/controllers/api.controller.ts`: an `import` and one line beside the others,
   `protectedApiRouter.route('/', programmeWindowRouter);`. Anything signed-in goes on `protectedApiRouter`.
6. **Write the unit test**, `tests/contoh-route.test.ts`, from `programme-windows-route.test.ts`: call
   `usePlaceholderEnv()` in `before`, import the controller after it, and pass fake `deps` to `createContohRouter`.
   `callRouter(router, user, 'GET', '/contoh')` (`tests/support/router.ts`) sends the request with a session. Test at least:
   the member with the role gets the list, a member **without** the role gets 401, a signed-out request gets 401, and the
   route is mounted. A made-up member's student number needs a sequence of 900 or more: `testUser('u1', { nim: '13525901' })`.
   Mounted is checked in the API's description, because an unknown path answers 401 as well:
   ```ts
   const doc = JSON.parse(JSON.stringify(openApiDocument(createApp()))) as {
     paths: object;
   };
   assert.ok('/api/programme-windows' in doc.paths);
   ```
   Run it: `pnpm --filter api exec tsx --test tests/contoh-route.test.ts` (expect `# pass 3`).
7. **Regenerate the web client** from the repository root: `pnpm --filter web api`. It prints `openapi: 72 paths written…`
   and adds files under `apps/web/src/api/generated/` (a `ContohService.ts`, the models, and lines in `ApiClient.ts`
   and `index.ts`). Commit them. You call it as `api.contoh.listContoh()`, as `queries.ts` calls `api.course.getCurrentUserCourse()`.
8. **Mirror the role in the web app** if the web app shows or hides something by it: a row in
   `apps/web/src/lib/capabilities.ts` and a check in `apps/web/tests/capabilities.test.ts` that reads your controller
   (steps 3 and 4 of [add a service to Layanan](add-a-service-to-layanan.md)).
9. **Give the pretend API an answer**, `apps/web/e2e/support/handlers.ts`, once a screen in the web app asks for it:
   ```ts
   'GET /api/category': signedIn(({ db }) =>
     ok<R<CategoryService['getListCategory']>>({ categories: db.categories }),
   ),
   ```
   For a role-only route use `withRole(['akademik'], …)` from the same file, which answers 401 like `roleMiddleware`.
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
| Step 5 | The unit test `the route is mounted in the app` fails on `'/api/contoh' in doc.paths`. A signed-out `GET` gives 401 either way. |
| Step 7 | CI step "The generated API client matches the API": it lists the changed files and `Run 'pnpm --filter web api' and commit apps/web/src/api/generated.` |
| Step 8 | `capabilities.test.ts`: `every capability is checked against the server` and `SERVER[capability] is not a function` |
| Step 9 | The journey that reaches your call: `The mock guard caught requests with no handler: GET /api/contoh: no handler` |
| A role check in step 4 | Nothing. Your test for "a member without the role gets 401" is the only guard, so always write it. |

Anything the route returns reaches the member's phone. Never send who wrote a Curhat message or owns a room, or another
member's private fields ([AGENTS.md](../../AGENTS.md), "Never compromise").
