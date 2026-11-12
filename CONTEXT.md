# PIPS! glossary

The words this repository uses, with the name each has in code where that differs. Read it once; check it when a
word confuses you. Members' names for services are kept exactly as the app spells them (including the "!"), and
they are never renamed. The reasons behind the big choices are in [docs/adr/](docs/adr/README.md).

An _Avoid_ line is advice for code, docs and conversation. For words on screen, a test enforces only the list in
`apps/web/src/copy/glossary.ts`.

## The product and HMIF

**PIPS!** — The HMIF ITB members app: a web app (`apps/web`) that installs on a phone like a native app, and its
API (`apps/api`). The name always has the "!".
_Avoid_: "HMIF App" (the copy check rejects it), "Pips", "the portal".

**HMIF ITB** — Himpunan Mahasiswa Informatika, the students' association of Informatics at Institut Teknologi
Bandung. It owns the app and its logo, which only ever appears as the official file `/logo/hmif.png`, whole.

**anggota** (member) — A person with a row in the `users` table (`apps/api/src/db/schema.ts`). Only people already
in that table can sign in, with their Google account. Code: `user`, `UserWithRoles`.
_Avoid_: "user" in anything a member reads.

**pengurus** — A committee member: an anggota who holds at least one role. There is no `pengurus` field in code;
it is simply the roles in `user_roles`. What a role allows is in the next entries.
_Avoid_: "admin" (that is one specific role), "staff".

**angkatan** — A year of entry, such as 2025. A row in the `angkatan` table; each member has one
(`users.angkatan`). Announcements and forms can be aimed at an angkatan.
_Avoid_: "batch", "class" (a course's class is another thing).

**HMIF Welfare** — The team that answers Curhat Yuk!. In code it is whoever holds the role `curhatadmin`, not the
division role `welfare`. Code: `CURHAT_ADMIN_ROLE` in `apps/api/src/lib/curhat.ts`.

**role** — A string in `user_roles` (the list is `rolesEnums` in `apps/api/src/db/roles-group.ts`). Most roles name a
division and give no special rights. These do:
- `admin`: delete others' announcements and comments, edit the course catalogue, run Live Counting and Rekap Form,
  read Data SPARTA Magang.
- `akademik`: add Akademik events and testimonials, edit the course catalogue.
- `ring1`: add Himpunan events and send a push to everyone.
- `cnc`: add, change and delete competitions in Info Lomba.
- `peoplemanage`: read Data SPARTA Magang.
- `curhatadmin`: read and answer every Curhat room.
A category can also list the roles allowed to post in it (`categories.roles_allowed`).

## Services and screens (names as members see them)

**Beranda** — Home: what needs the member's attention (Perlu ditindaklanjuti), unread announcements and the
service tiles. Path `/`.
_Avoid_: "Home", "Dashboard".

**Pengumuman** — The feed of announcements ("info" in the API and the database). Each has categories, an optional
audience (angkatan or group), photos, reactions and comments, and is marked read when opened. **Umumkan ulang**
sends the notification again. Code: `info`, `/pengumuman`.
_Avoid_: "Timeline", "Announcement", "post" in the interface.

**Kalender** — Calendar events, in two categories, `akademik` (per course) and `himpunan`. Code: `calendar_event`,
`calendar_group`, `/kalender`.

**Layanan** — The list of services, built from the service registry. Path `/layanan`.
_Avoid_: "Services", "Menu".

**Profil** — Opened from the avatar, not a tab. Holds the member card, Informasi akun, **Mata kuliahku** (the courses
the member takes this semester), Tampilan (light, dark or the system's), **Notifikasi** (which announcement
categories send a push), **Kredit** and **Keluar** (sign out). Paths under `/profil`.
_Avoid_: "Settings", "Pengaturan".

**Masuk** — The sign-in page (`/login`). **Mulai** is the short first-run flow after a first sign-in (`/mulai`).
**Pasang PIPS!** is the prompt to install the app on a phone.
_Avoid_: "Login", "Sign in".

**Ding Dong** — Folders of course materials for the semester's courses. _Avoid_: "Materi kuliah".

**Testi Matkul** — Testimonials about courses, written by older students, found by program, semester and course.
Code: `testimoni`, `/layanan/testi`.
_Avoid_: "Testimoni matkul".

**NIM Finder** — Finds a member by name or NIM and shows name, NIM, programme and photo, at most 30 results
(`apps/api/src/lib/nim-finder.ts`). Nothing else about a member leaves the API through it.
_Avoid_: "Cari NIM".

**Info Lomba** — Competitions whose registration is still open. Code: `competitions`.

**Curhat Yuk!** — An anonymous chat between a member and HMIF Welfare. A **room** is one conversation; a member may
keep up to three; every message carries an id made on the device (`clientMessageId`, decision 9). A notification
says only "Pesan baru di Curhat Yuk!". Welfare uses the inbox under Kelola.
_Avoid_: "chat", "Curhat" without "Yuk!", "hotline".

**Form** — Forms HMIF sends to an angkatan, open between `opens_at` and `closes_at` (`forms` table).
**Live Counting & Rekap Form** is the admin's live view of who has filled a form, and its summary.

**Magang SPARTA** — The internship division choice for angkatan 2025 (plus a few approved exceptions), with a
closing date. **Data SPARTA Magang** is the admin's table of the submissions. Code: `internship_*`.

**Beasiswa, LowonginAja!, Bayar Kas!, Surat & Proposal** — Links to outside pages, opened in a new tab: registry
entries with `kind: 'external'`.

**Kelola** — The area for pengurus, shown only to roles that may do something in it (Live Counting, Data SPARTA
Magang, adding events, competitions and testimonials, the Curhat inbox). Paths under `/kelola`.
_Avoid_: "Admin Dashboard".

## The code's own words

**Garis** — The app's design system: tokens, components and icons written by hand for HMIF. Folders
`apps/web/src/styles/garis/` and `apps/web/src/components/garis/`. See decision 14. Lint rules in
`apps/web/eslint-rules/garis.mjs` protect it.
_Avoid_: "the UI kit", "theme".

**the shell** — The frame around every page inside the app: tab bar, rail, sidebar, top bar, back and global search
(`apps/web/src/components/shell/`). It imports no feature code.

**service registry** — The one typed list of services that Layanan, Beranda and search read
(`apps/web/src/lib/services.ts`). A service has a name, a destination, a group and, if needed, the capability that
unlocks it.

**route table** — The one table of pages with their titles, parents and tabs
(`apps/web/src/lib/shell/routes.ts`). TypeScript refuses to build until a new route has an entry.

**capability map** — The web app's table of what each role may do (`apps/web/src/lib/capabilities.ts`). A tool is
shown only through `can(user, capability)`. A test keeps it in step with the API's checks.

**copy modules** — The files in `apps/web/src/copy/`, one per area, that hold every sentence the app shows. Their
**glossary** (`copy/glossary.ts`) lists the house terms and the words that must not be used.
_Avoid_: writing a sentence inside a component.

**programme window** — A period in which something is open to chosen people: a row of `programme_windows` with a
label, a route, an open and close time and the eligible angkatan or NIMs, served by `GET /programme-windows`. Forms
and Magang SPARTA use the same window rule (`apps/api/src/lib/programme-window.ts`). The web app does not read the
route yet.

**journey** — A browser test of what a member does, step by step (`apps/web/e2e/journeys/`). Each runs at phone,
tablet and desktop size in light and dark: six **projects** (`apps/web/e2e/playwright.config.ts`).

**pretend API** — Test code that answers every request a journey makes from sample data
(`apps/web/e2e/support/mock.ts`, `handlers.ts`). No journey reaches a real server.

**fixed clock** — Every journey starts at Thursday 8 October 2026, 13.35 WIB, so dates and screenshots repeat. A
journey can opt out with `now: null`.

**gate** — A quality check every journey screen must pass: accessibility scan, no sideways scroll, no text under
12 px, visible focus (`apps/web/e2e/support/audit.ts`, `strict.ts`). CI runs them with `E2E_GATES=strict`.

**visual reference** — A screenshot kept in Git that a screen is compared with, one set per platform
(`apps/web/e2e/visual/`). A screen may differ by at most 0.1 % of its pixels.
