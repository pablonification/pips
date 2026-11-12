# Decision records

A decision record explains one choice that shapes this repository: what was decided, what else was possible, what
the choice costs today and when to look at it again. Read the one that matches the code you are about to change.
The words they use (angkatan, Garis, journey, gate) are explained in [CONTEXT.md](../../CONTEXT.md).

Add a record when a decision is hard to reverse, would surprise someone who did not see it being made, or is a real
trade-off between two good options. Do not add one for a style rule or a choice that is easy to undo. Name the files
where the decision lives, and write the cost honestly: that section is the point. When a decision changes, write a
new record and set the old one's status to "superseded by N" rather than rewriting history.

Each record is named `NNNN-a-sentence-that-states-the-decision.md` and follows the shape in 0001.

| # | Decision | What it costs |
| --- | --- | --- |
| [1](0001-the-web-app-and-the-api-live-in-one-repository.md) | The web app and the API live in one repository | Rules both apps need are copied and kept equal by tests |
| [2](0002-the-web-app-is-react-with-vite-and-the-api-is-a-hono-server.md) | The web app is React with Vite and the API is a separate Hono server | The API's tools are a generation behind the web app's |
| [3](0003-every-api-route-is-described-and-the-web-client-is-generated-from-it.md) | Every API route is described with zod, and the web client is generated from it | Three files per route; a handler can answer what its route doesn't describe |
| [4](0004-controllers-take-their-storage-as-a-parameter-so-route-tests-need-no-database.md) | Controllers take their storage as a parameter | Half done; fake storage does not prove the SQL, so CI runs database tests too |
| [5](0005-the-api-runs-its-typescript-directly-in-a-container.md) | The API runs its TypeScript directly, in a container | A type error does not stop the server from starting |
| [6](0006-migrations-only-add-things-and-run-before-the-new-code-goes-live.md) | Migrations only add things, and run before the new code goes live | A person must remember to migrate |
| [7](0007-the-session-is-a-signed-cookie-and-the-api-keeps-no-session-table.md) | The session is a signed cookie and there is no session table | A lost phone stays signed in until its token ends (renewed with use, up to 180 days) |
| [8](0008-roles-are-read-from-the-database-and-the-web-app-mirrors-them.md) | Roles are read from the database, and the web app mirrors them | A route that forgets its role check is open to every member |
| [9](0009-curhat-messages-carry-an-id-made-on-the-device.md) | Curhat messages carry an id made on the device | The biggest client logic in the app; anonymity stops at the API |
| [10](0010-the-api-runs-as-one-process-and-keeps-its-state-in-memory.md) | The API runs as one process with its state in memory | It must never run as two copies; a restart loses pushes and reminders |
| [11](0011-the-api-sends-web-push-itself.md) | The API sends web push itself | iPhone needs the app installed; nothing is queued |
| [12](0012-every-page-is-its-own-file-loaded-on-demand-under-a-size-cap.md) | Every page is its own file, loaded on demand, under a size cap | Hand-written splitting rules that few people understand |
| [13](0013-only-a-short-list-of-data-stays-on-the-device-and-sign-out-wipes-it.md) | Only a short list of data stays on the device | Little works offline; the wipe takes unsent drafts |
| [14](0014-the-design-system-is-written-by-hand.md) | The design system, Garis, is written by hand | Every component is ours to write and keep accessible |
| [15](0015-every-sentence-the-app-shows-lives-in-copy-modules-checked-against-a-glossary.md) | Every sentence lives in copy modules, checked against a glossary | Words live in a different file from the screen |
| [16](0016-a-service-registry-and-a-route-table-keep-the-shell-ignorant-of-features.md) | A service registry and a route table | A new page touches several files; registration is indirect |
| [17](0017-journeys-run-a-production-build-against-a-pretend-api-on-a-fixed-clock.md) | Journeys run against a pretend API on a fixed clock | The pretend API can drift from the real one; timer bugs hide |
| [18](0018-every-journey-passes-quality-gates-and-screens-are-held-by-screenshots.md) | Quality gates on every journey, and screenshot references | Two sets of pictures to record; pixel checks fail on harmless changes |
| [19](0019-every-pull-request-runs-every-journey-in-all-six-projects.md) | Every pull request runs every journey in all six projects | Five CI machines for every change, even a one-word fix |
