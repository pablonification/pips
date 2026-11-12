# Add a service to Layanan

A new row in Layanan that only one role sees. The steps were tried on a made-up service, "Contoh", that opens
`/layanan/contoh` and is listed for members with the `akademik` role. Replace `contoh`, the label and the role with
yours. The page itself comes from [add a screen](add-a-screen.md); a role check on the server comes from
[add an API route](add-an-api-route.md). **Hiding a row only hides the row.** The page's data must be protected by a
role check in the API, which the web app mirrors here.

Layanan, Beranda's tiles and global search all read one list, `SERVICES` in `apps/web/src/lib/services.ts`
([CONTEXT.md](../../CONTEXT.md): *service registry*). Nothing else draws the row, so a new service is one entry plus the
role. Everything is under `apps/web/`.

## Steps

1. **Pick the group.** `SERVICE_GROUPS` in `src/lib/services.ts` lists them: `Kuliah`, `Teman dan himpunan`,
   `Kesempatan`, `Administrasi`, `Kelola`. Put a page for one role in the group it belongs to by topic (the trial used
   `Kuliah`). `Kelola` is the pengurus hub's own list, and six tests list its rows by hand (see "What will stop you");
   use it only for a real Kelola tool.
2. **Add the entry** to `SERVICES`, in its group's place, like Ding Dong:
   ```ts
   {
     id: 'dingdong',
     label: 'Ding Dong',
     description: 'Folder materi mata kuliahmu semester ini',
     group: 'Kuliah',
     kind: 'internal',
     destination: '/layanan/dingdong',
     owner: 'akademik',
     synonyms: ['materi', 'drive', 'folder', 'kuliah'],
     icon: 'folder',
   },
   ```
   `destination` is checked against the route tree, so it must be a page that exists. `icon` is one of the keys in
   `ServiceIconKey` (`folder`, `testi`, `nim`, `kelola`, …); a new icon is drawn by a maintainer
   ([design system](../design-system.md), "Icons"). `synonyms` are lower case, for global search. The label and the
   description are words on screen: Indonesian, *kamu* voice, and the label is the name members will know, so choose it
   once. `owner` is the team that looks after it.
3. **Add the capability** so the row shows only for the role. In `src/lib/capabilities.ts`, a row like the others:
   ```ts
   /** Add a competition to Info Lomba: `competitions.controller.ts`, roleMiddleware(['cnc']). */
   createCompetition: ['cnc'],
   ```
   with a comment naming the API controller that checks it, and set `capability: 'yourName'` in the service entry.
   Until the row exists the type check fails: `Type '"viewContoh"' is not assignable to type '"createCompetition" | …'`.
4. **Prove the web's role matches the API's.** `tests/capabilities.test.ts` reads the API's route table
   (`apps/api/src/lib/route-access.ts`) for every capability. Add an entry to its `SERVER` object, copied from
   `createCompetition`, naming the routes your capability uses:
   ```ts
   createCompetition: () => routeRoles('POST /api/competitions'),
   ```
   Then the test `Raka (akademik, admin) gets exactly the tools his roles allow` in the same file lists what his roles
   grant, in alphabetical order: add your capability there if Raka's roles include yours.
5. **Test who sees it.** Add a short test to `tests/services.test.ts`, which already has `nadia` (no roles),
   `raka` and `visibleServices(user, NOW)`: Nadia's list doesn't include your id, and a user with the role does. Then
   add a journey to the `Raka` block of `e2e/journeys/layanan.spec.ts` (extend it rather than start a file): open
   `/layanan`, check the row's `href` with `row(page, /^YourLabel/)`, click it, and check the URL.
6. **Run the checks.**
   ```bash
   pnpm --filter web check
   pnpm --filter web test                   # expect "# fail 0"
   pnpm --filter web exec playwright test -c e2e --project=phone-light --project=desktop-light layanan search beranda services
   ```
   The last command took under three minutes with `kelola` and `visual` added, and all 230 journeys passed with the new
   row, so a one-role service in an ordinary group breaks no existing journey.

## What will stop you

| You skipped | What prints |
| --- | --- |
| `capability` names a row that isn't in `capabilities.ts` | `error TS2322: Type '"viewContoh"' is not assignable to type …` |
| The `SERVER` entry (step 4) | `tests/capabilities.test.ts`: `viewContoh mirrors the server's roles` fails with `SERVER[capability] is not a function`, and `every capability is checked against the server` fails too |
| Raka's list (step 4) | `Raka (akademik, admin) gets exactly the tools his roles allow` shows the extra name in the diff |
| A `destination` that is not a page | `tests/services.test.ts`: `internal destinations are routes in the route tree` names your id |
| A role check in the API | `routeRoles` fails with `POST /api/… is for named roles in the API` until the route's row lists roles; `apps/api/tests/route-access.test.ts` fails until the route's check matches its row. |

**If you chose `Kelola`,** these also fail until you list your row in each: `kelolaServices` and `kelolaAccess` in
`tests/kelola-rules.test.ts`; `groups in order; Kelola only with a capability, last` and `Kelola per role` in
`tests/layanan-rules.test.ts`; `the inbox, its Kelola row and the pin are curhatadmin's only` in
`tests/curhat-inbox-rules.test.ts`; and `Raka's Kelola group holds his tools only` in `tests/services.test.ts`. In the trial a
Kelola row failed nine unit tests (those six and the three capability ones), a Kuliah row only the three.
