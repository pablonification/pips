# Fixtures: where the prototype's data and the real API differ

`prototype.ts` ports the locked prototype's sample data
(`ops/ui-revamp-review/runtime/extra/garis-v4/locked-2026-10-12/source/garis/data.js`) as is. `api.ts` turns it
into the real API's shapes, typed with the generated models in `src/api/generated`. Where the two don't fit, the
fixtures follow the API, as listed here.

## The clock

- The prototype's "now" is **Kamis, 8 Oktober 2026, 13.35 WIB** (`NOW` in data.js), and the harness's fixed
  clock uses it. The T3 brief asked for 09.00 WIB; at 09.00 three of the seven posts (10.40, 12.30) and both
  comments on p1 would be in the future, Raka's 10.00 quiz would be upcoming instead of past, and the relative
  times would differ from the locked screens. 13.35 keeps the fixtures and the locked screens consistent. It is
  one constant (`NOW` in `prototype.ts`); the report for T3 lists this as a deviation.

## People and accounts

- **IDs:** the API uses UUIDs; the fixtures use readable ids (`user-13525045`, `course-IF2110`, post `p1`, room
  `r1`, form `pixel`). The app treats ids as opaque strings.
- **Photos:** people have no photos in the prototype (it draws initials). `picture` points at
  `/__e2e__/avatar/<nim>.svg`, which the mock layer draws as initials, so no test loads a Google photo.
- **Gender** isn't in the prototype; the fixtures set one per person because `User.gender` is required.
- **Membership status:** "Anggota Biasa" for both, as the prototype says (PIXEL's real status is unknown).
- **Roles:** Raka has `welfarenakademik`, `akademik`, `de` and `admin`, as in the prototype. Groups come back as
  `{ role, group }` with the display names from `roles-group.ts`.
- **NIM Finder members** that the prototype gives only a name, NIM and programme get the same defaults (campus
  Ganesha, gender F, angkatan from the NIM).

## Angkatan

- The API's `Angkatan.name` is a non-null string; the prototype has `null` for 2023 and 2024 (names unknown). The
  fixtures send an empty string.

## Announcements

- **Links:** the prototype shows a link card (`link.kind`: sheet, gform, web). The real app stores links in the
  post's text and fetches an Open Graph preview. The fixtures append the URL to the text when the body doesn't
  already contain it (`https://docs.google.com/spreadsheets/d/e2e-jadwal-uts`,
  `https://docs.google.com/forms/d/e/e2e-gemastik-tim/viewform`), and `GET /api/open-graph` answers with the
  prototype's link title.
- **Photo on p6:** `media: 1` becomes one `infoMedias` entry pointing at a generated image.
- **Read state** is per persona (`READ0`), sent as `isRead`.
- **Visibility:** the API filters posts per member. The fixtures apply the prototype's rule (`canSee`): Nadia
  doesn't get p5 (for the akademik group); Raka doesn't get p3 (for angkatan 2025).
- **Reactions** become `ReactionAggregate` (`reactionsCount` in the prototype's reaction order).
- **Comment ids** are `<post>-c<n>`.

## Calendar

- Events become `CalendarEvent` with `calendarGroupId` `group-<code>` (or `group-himpunan`), the semester
  (Ganjil 2026), and a placeholder Google Calendar link. `GET /api/calendar/me` returns Himpunan events and the
  persona's course events for the month, like the API.

## Courses

- The catalogue becomes `Course` with curriculum year 2024. Rows with semester 0 in the prototype (electives,
  general courses) become `type: 'Elective'`, `semester: null`. Ding Dong URLs are placeholders
  (`https://drive.google.com/drive/folders/e2e-<code>`); IF4010 has none, as in the prototype.

## Testi Matkul

- The prototype's author "Anonim" is the API's `userName: null` (the API stores no name for anonymous
  testimonials; showing "Anonim" is the redesign's job). Named ones keep their text ("Nabila, IF 2024").
- IF testimonials fill `overview`, `assignments` (Tugas) and `lecturer_review` (Review Dosen); STI ones fill
  `impressions` (Kesan), `challenges` (Tantangan) and `advice` (Saran). `lecturer` stays null, as the prototype
  leaves lecturer names out.

## Info Lomba

- `price` is a string in the API; free competitions send `null` ("FREE" in today's app). Posters are generated
  3:4 images. Registration and source links are placeholders on `example.org`.

## Curhat Yuk!

- Rooms come back as the API's map keyed by room id, messages newest first with `isSender`, and `reply` filled
  for replies (m4 replies to m3). The API has no per-message unread flag; `GET /api/curhat/chatrooms/unread`
  reports one unread message in r1 (m4), as the prototype marks it.

## Forms

- **Questions:** the fixture uses the prototype's version of "Form Analisis Kondisi PIXEL": the same five
  sections and question ids as the real seed (`apps/api/src/db/seed/pixel-form-seed.ts`), with some long
  questions left out (q7, q10, q11, …) and the "Other" follow-ups worded as the prototype words them
  ("Sebutkan yang kamu maksud. …"). Section ids come from the seed.
- **My response:** the API answers `GET /api/form/:id/my-response` with `200 null` when you haven't responded;
  its OpenAPI type (`FormResponse`) leaves the null out. The default handler follows the API.
- **Status** comes from the clock: the form opened Sabtu, 12 September 2026, 13.00 WIB, so it is `open` for
  Nadia. Raka (angkatan 2024) gets no forms.

## Admin

- **Live Counting:** the prototype has a count (142) and four latest submitters. The fixtures add 138 more
  deterministic fictional responses so the recap table pages work, and analytics for q4 and q16 from the
  prototype's numbers.
- **SPARTA Magang** isn't in the prototype's data at all. The fixtures invent two departments, three divisions
  and three submissions (Bima, Tasya, Nadia), enough for the admin table and the detail page.

## Credits

- The prototype has no credits text; the fixture uses one sample line.
