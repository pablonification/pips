# e2e/qa: F2's cross-cutting checks

Checks that cut across every page, written during F2 (the independent QA pass). They reuse the harness
(`support/test.ts`, the mock, `strictAudit`) and add no screenshot comparisons; evidence goes to files instead.

| Project | Spec | What | In `pnpm e2e` (CI) |
| --- | --- | --- | --- |
| `qa-<phone\|tablet\|desktop>-<light\|dark>` | `screens.spec.ts` | Every page as each person it differs for: the strict audit; one `main`, one visible "Navigasi utama", one `h1` in the whole DOM (none hidden by CSS); Archivo Expanded only on titles, the greeting, the wordmark and the member card; no monospace; no CSS capitals; tabular figures on times, NIMs and codes; SVGs hidden from screen readers and coloured by `currentColor` or tokens; no `<img>` icons; alt text; the official logo's sizes and places; a status region from the start; external links named "situs luar, tab baru". `QA_EVIDENCE=<folder>` saves each page's accessibility tree. | yes |
| same | `keyboard.spec.ts` | A Tab walk on every page: the skip link first, a name at each stop, a focus ring of 2 px or more with 3:1 against what's behind it, no stop under a fixed or sticky bar. | yes |
| same | `errors.spec.ts` | Every page with its reads answering 503, then dropped: Indonesian with Coba lagi, never the API's text, and Coba lagi recovers. Every not-found state says so, with a way back. | yes |
| same | `links.spec.ts` | Sign-in's redirect check against every unsafe target; the manifest; the theme colour and no flash of the other theme. | yes |
| same | `roles.spec.ts` | Each role sees exactly its own tools (Kelola, Tambah acara and which kind, Tambah lomba, Tambah testimoni). | yes |
| `qa-reflow` | `reflow.spec.ts` | Every page at 400 % zoom (320 × 256 CSS px, device scale 4): no sideways scrolling, nothing cut off. | yes |
| `qa-motion` | `motion.spec.ts` | The app's own motion (`motion: 'on'`): nothing moves under reduced motion; the shell never animates on first paint; overlays close faster than they open. | yes |
| `qa-sw` | `sw.spec.ts` | The service worker runs: the installed app opened offline, and the share target. | yes |
| `qa-london-phone-light` | `journeys/{kalender,beranda,lomba,form,compose,announcements}.spec.ts` | The time-heavy journeys with the device in Europe/London: times stay in WIB. | yes |
| `qa-perf` | `perf.spec.ts` | SPEC's lab phone on seven pages, three runs each: `QA_PERF_OUT=<file.jsonl>`. | no, by hand |
| `qa-copy-<phone\|tablet\|desk>` | `copy.spec.ts` | The app's visible text against the locked prototype's, screen by screen: `QA_PROTOTYPE_URL` (the locked `source/` served locally) and `QA_COPY_OUT`. | no, by hand |

`lib.ts` holds the pure rules (colours and contrast, the text normaliser, the motion threshold), unit-tested in
`tests/qa-lib.test.ts`; `probe.ts` reads the facts in the page.
