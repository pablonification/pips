# Forms: the API for the member's form and the builder

What the server does for forms, route by route: who may call each, what it takes and what it answers. Read it before
building a form screen. The reasons are in [decision 23](adr/0023-forms-are-built-by-any-pengurus-shared-like-google-forms-and-answered-with-agreed-profile-fields.md);
the words (anggota, pengurus, angkatan) are in [CONTEXT.md](../CONTEXT.md). The generated client
(`apps/web/src/api/generated`, `FormService`) has every route below with its types.

## The model in one page

- **A form** has an owner (a pengurus; null for the PIXEL form, made before the builder), a title, a description,
  sections of questions, the angkatan it is for, an opening and a closing time, a short name for its link, the profile
  fields it requests, the sent screen's words (`thanks`), and whether members may change what they sent
  (`allowEdit`). It is a **draft** until published (`publishedAt` null); members never reach a draft.
- **Questions** are JSON in `forms.sections` (`apps/api/src/lib/form-model.ts`). Kinds, by their stored name:

  | `type` | On screen | Answer (`answer`) |
  | --- | --- | --- |
  | `text` | Jawaban singkat | a string |
  | `textarea` | Paragraf | a string |
  | `radio` | Pilihan ganda | one option; `__other` for "Lainnya", with the words in `other` |
  | `checkbox` | Kotak centang | a list of options (each once); `__other` in it for "Lainnya", with `other` |
  | `dropdown` | Dropdown | one option (no "Lainnya") |
  | `rating` | Skala linier | the number as text, within `scale` (`min` 0 or 1, `max` 2 to 10, optional `minLabel`, `maxLabel`); no `scale` means 1 to 5 |
  | `date` | Tanggal | `YYYY-MM-DD` |
  | `time` | Waktu | `HH:MM`, 24 hours (the screen shows and takes `19.30`; send `19:30`) |
  | `file` | Unggah file | the file's address in the app's storage (upload it first with `POST /api/media/upload`), JPG, PNG or PDF |

  A question also has `description` (the hint under it), `optional` (not required), `other` (offers "Lainnya", radio
  and checkbox only) and `dependsOn: { questionId, value }` ("Tampilkan jika": shown, and required, only when that
  earlier choice question was answered with that option; a checkbox counts when the value is among its choices). A
  question hidden by its condition is skipped: leave its answer out, and the server drops one sent anyway.
- **Profile fields** a form may request (`requestedFields`, in this order): from the account, never typed, `fullName`
  (Nama), `nim`, `major` (Program studi), `angkatan`, `campus` (Kampus), `email` (Email mahasiswa); saved by the member
  in Data diri, `whatsapp`, `line`, `instagram`, `address` (Alamat selama kuliah), `hometown` (Kota asal),
  `emergencyContact` (Kontak darurat: name, relation, phone), `health` (Kondisi kesehatan), `birthDate`,
  `studentCardPhoto` (Foto KTM), `photo` (Foto diri). The prototype's groups: Dari akun (the first six), Kontak
  (WhatsApp, LINE, Instagram), Alamat (address, hometown), Darurat dan kesehatan (emergency contact, health),
  Identitas dan dokumen (birth date, Foto KTM, Foto diri); the sensitive ones (a lock and "sensitif" in the builder)
  are address, emergency contact, health, birth date and Foto KTM. The export's column names are
  `PROFILE_FIELD_LABELS` in `form-model.ts`; the screen's words come from `apps/web/src/copy/`.
- **A response** is one per member per form. It keeps the answers and, by field, the requested profile fields' values
  as they were sent (`profile`): what the member saw and agreed to. That is all the builder's side ever sees about who
  sent it.
- **Access.** Any pengurus (a member with at least one role) builds forms. On one form: the owner and people with
  **Edit** change it, its Setelan, its short name and who it is shared with, and may delete it; **Lihat jawaban** sees
  the form and its answers; **admin** does everything on every form. Nobody changes or removes the owner's row. Only
  pengurus can be added. `access` on every builder answer says what the caller may do:
  `{ role: 'owner' | 'edit' | 'view' | null, canView, canEdit, asAdmin }` (`asAdmin`: show "Form ini milik … Kamu
  mengubahnya sebagai admin.").

## The member's side (FORMS-B)

Any signed-in member. A draft is never found here (404).

| Route | Answers |
| --- | --- |
| `GET /api/form` | `{ forms }`: published, active forms for the member's angkatan, each with `status` (`open`, `not_opened`, `closed`, `already_responded`), `sectionCount`, `requestedFields`, `allowEdit`. |
| `GET /api/form/{formId}` | The form with `sections` (null for another angkatan, or before it opens), `status`, `requestedFields`, `allowEdit`, `thanks` (null: show the app's own words), `owner: { fullName } \| null` (for "Raka Pratama, pembuat form ini, dan pengurus yang ia beri akses …"), `canChange` (answered, the maker allows changes, still open: show "Ubah jawaban"). 404 for a draft or no form. |
| `GET /api/form/{formId}/my-response` | Your response or `null`: `answers`, `profile` (what went along), `submittedAt`, `updatedAt` (null if never changed: "Terkirim", else "Diperbarui"). |
| `POST /api/form/{formId}/response` | Sends. Body `{ answers, agreed?, details? }`. 201 with the response. |
| `PUT /api/form/{formId}/response` | "Ubah jawaban": the same body, replaces your response. 200 with it. |
| `GET /api/form-link/{name}` | Opening `app.hmif.dev/f/<name>` (the web route `/f/$name`, behind sign-in; `/login?redirect=` brings a signed-out visitor back). `{ state, formId, title, eligibleAngkatan, canManage }`: `form` (open the form's page), `not_for_you` (another angkatan: show only the title, "Form ini bukan untuk angkatanmu" and who it is for; `canManage` adds "Kelola form ini"), `draft` (only for those who manage it: "Form ini belum diterbitkan"). 404: no form has the name ("Form tidak ditemukan"). A renamed form's old name is 404. |
| `GET /api/user/details` | Data diri: `{ account: { fullName, nim, major, angkatan, campus, email }, saved }` with `major` and `campus` in words and `angkatan` as the year; each saved detail is null until given. |
| `PATCH /api/user/details` | Changes saved details: a value sets one, `null` removes it ("Hapus"), a missing key leaves it. 200 with the same shape as `GET`. |

**Sending, and the agreement step.** The server checks in this order and answers the first problem:

1. 404 no such form, or a draft; 403 not for your angkatan, not open yet, or closed (`PUT`: also 403 when the maker
   doesn't allow changes, 404 when you have nothing to change).
2. 400 `{ error }`: an answer that doesn't fit (`Unknown question`, `Answer does not fit question`, `Lainnya needs its
   words`), then `Missing required answers: <labels>`.
3. Only when the form requests fields: 400 `{ error }` without `agreed: true`; 400 `{ error, problems }` when a
   detail in `details` doesn't fit (same problems as Data diri, below); 400 `{ error, missing: [fields] }` when a
   requested saved detail is neither in the profile nor in `details`.
4. `POST`: 409 if you already sent it.

A detail filled in at the agreement step goes in `details` (the same shape as `PATCH /api/user/details`); the server
saves it to Data diri, then sends. A form with no `requestedFields` has no agreement step: send without `agreed`.

**Data diri's checks** (`apps/api/src/lib/member-details.ts`), per field in `problems`: `empty` (blank; send `null`
to remove), `too_long`, `phone` (Nomor WhatsApp and the emergency phone: digits, spaces, `-`, `.`, a leading `+`, at
least nine digits), `date` (a real date, after 1950, before today, `YYYY-MM-DD`; the screen takes `14/03/2007`),
`file` (Foto KTM, Foto diri: a JPG or PNG in the app's storage). An emergency contact is `{ name, relation, phone }`,
relation one of Ayah, Ibu, Wali, Saudara, Lainnya.

## The builder's side (FORMS-C)

Pengurus only: a member with no role gets 401 `{ error: 'Unauthorized' }` on every route here. A form the caller may
not see is 404; a Lihat jawaban trying to change it is 403.

| Route | Who | Takes | Answers |
| --- | --- | --- | --- |
| `GET /api/form/manage/list?scope=mine\|all` | pengurus; `all` only admin (403) | | `{ forms }`: Buatanku and Dibagikan ke aku (`mine`: made by you or shared with you), or every form (`all`). Each: `id`, `slug`, `title`, `status` (`draft`, `scheduled`, `open`, `closed`), `eligibleAngkatan`, `opensAt`, `closesAt`, `questionCount`, `responseCount`, `owner` (`{ id, fullName, nim, picture }`, null for PIXEL), `access`, `updatedAt`. Newest change first. Split mine and shared with `access.role === 'owner'`. |
| `POST /api/form` | pengurus | `{ title? }` | 201, the new draft (as `GET …/manage`): one untitled section with one Pilihan ganda ("Opsi 1"), `requestedFields: ['fullName', 'nim']`, no angkatan, a short name from the title (`form-baru`, `form-baru-2` … when untitled). |
| `GET /api/form/{formId}/manage` | owner, shared, admin | | The form for the builder: everything above plus `slugCustom`, `isActive`, `publishedAt`, `owner`, `access`, `responseCount`, `audience` (members in its angkatan: "87 dari 132 anggota"), `createdAt`, `updatedAt`. |
| `PATCH /api/form/{formId}` | owner, Edit, admin | any of `title`, `description`, `sections`, `requestedFields`, `eligibleAngkatan`, `opensAt`, `closesAt` (ISO times or null), `allowEdit`, `thanks`, `confirmBreaking` | The saved form. Autosave sends what changed. 400 `{ error }` for a definition that can't be saved (ids twice, options on a non-choice, "Lainnya" on a dropdown, an option named `__other`, a scale out of range, a condition on a later or non-choice question or on a value it doesn't offer, too many or too long), for a published form left with no angkatan or no opening time, or a closing time not after the opening. **409** `{ error, breaking: [{ questionId, label, change: 'removed' \| 'type' }], responseCount }` when the form has answers and the edit removes a question or changes its kind to one that can't read them; send it again with `confirmBreaking: true` and those answers are deleted for good. Kinds that keep answers: Jawaban singkat ↔ Paragraf, Pilihan ganda ↔ Dropdown, and either to Kotak centang. Wording, options and order never ask. A draft's short name follows its title until someone chooses one. "Tutup form sekarang" is `closesAt` now. |
| `POST /api/form/{formId}/publish` | owner, Edit, admin | | The published form (`status` `open` or `scheduled`). It opens now unless an opening time was set, and takes a short name from its title unless one was chosen. 400 `{ error, problems }` with, in the dialog's order, `no_title`, `no_questions`, `unwritten_question`, `one_option` (a choice question with under two written options), `no_angkatan`, `closes_before_opening`, `already_closed`. 409 when already published. |
| `DELETE /api/form/{formId}` | owner, Edit, admin | | 204. The form and every answer go; its link finds nothing. |
| `GET /api/form/{formId}/slug-check?slug=` | owner, Edit, admin | the name as typed | `{ slug, available, problem }`: `slug` tidied (lower case, spaces and `_` as `-`), `problem` one of `too_short`, `too_long`, `characters`, `hyphens`, `taken`, or null. The "Tersedia" line, about 300 ms after the last key. The form's own name is available. |
| `PUT /api/form/{formId}/slug` | owner, Edit, admin | `{ slug }` | The form, renamed (`slugCustom` true). 400 `{ error, problem }` for a name the link can't have; 409 `{ error, problem: 'taken' }`. The old name is let go at once: its link is 404 and another form may take it. Lihat jawaban may only copy the link. |
| `GET /api/form/{formId}/access` | owner, shared, admin | | `{ owner, people: [{ person, role }] }`, in the order they were added. |
| `GET /api/form/{formId}/access/search?search=` | owner, Edit, admin | a name or NIM, 3 characters or more (400 under) | `{ people: [{ person, isPengurus, role }] }`, at most 20, as NIM Finder orders them. `isPengurus` false: "Bukan pengurus", can't be picked. `role`: `owner`, `edit`, `view` or null. |
| `PUT /api/form/{formId}/access/{userId}` | owner, Edit, admin | `{ role: 'view' \| 'edit' }` | The access list. Adds a person or changes their role. 400 for the owner or someone who isn't pengurus; 404 no such member. New people start as `view` ("Lihat jawaban") on the screen. |
| `DELETE /api/form/{formId}/access/{userId}` | owner, Edit, admin | | The access list ("Hapus akses"; Urungkan is a `PUT` again). 400 for the owner. |
| `GET /api/form/{formId}/answers/summary` | owner, shared, admin | | `{ total, audience, questions }`. Per question: `answered`, and by kind `counts` (choices and scales list every option or number in order, 0 included; "Lainnya" counts as `__other`; dates and times list the values given, earliest first), `average` for a scale, `texts` (text answers and "Lainnya" lines, newest first, at most 100), `files` (`{ url, name }`, newest first, at most 100). An answer to an option since removed still counts under its own words. |
| `GET /api/form/{formId}/answers?page=&limit=` | owner, shared, admin | `limit` 1 by default, up to 100 | `{ responses, total, page, limit }`, oldest first. Each: `id`, `number` (its place, from 1), `submittedAt`, `updatedAt`, `profile` (only the fields it carried), `answers`. Never who sent it beyond that. |
| `GET /api/form/{formId}/answers/export?format=xlsx\|csv` | owner, shared, admin | Excel by default | A file to save (`Content-Disposition: attachment; filename="<slug>-jawaban.xlsx"`). One row per response, oldest first; columns Waktu kirim, Diubah (WIB), each requested field (and any an older response carries), then each question. Choices joined with ", ", "Lainnya: …", a scale as a number, a file as its address. CSV has a byte-order mark and never lets a cell start a formula. Download it with `fetch(…, { credentials: 'include' })` and a blob, or a plain link. |

**Live count.** A socket that connects with `auth: { formAdminId: <formId> }` joins that form's room when the member
is admin, or a pengurus who owns the form or has it shared with them, and hears `form:new-response` with `{ total,
submittedAt }`, plus `nim` and `fullName` only when the form requests them (the PIXEL form's Live Counting gets them
as before).

**Live Counting & Rekap Form** (admin only) keep their routes, `GET /api/form/admin/list`,
`/api/form/{formId}/responses`, `/responses/count` and `/analytics`, for forms made before the builder (no owner: the
PIXEL form) and no others: they list who sent each response by name and NIM, which a builder form shows only when it
requests them. A builder form is 404 there and is not in the admin list.

## The pretend API

Every route above has an answer in the journeys' pretend API, from the forms prototype's sample forms
(`apps/web/e2e/fixtures/forms.ts`), with the API's own rules (`apps/web/e2e/support/forms.ts`):

| Form (`id`, link) | Owner, shared with | State on the fixed clock | Answers |
| --- | --- | --- | --- |
| `makrab`, `makrab-2026` | Raka; Aulia Edit, Dimas Lihat jawaban | open for 2025, closes 18 Oct; requests Nama, NIM, Kampus, WhatsApp, Kontak darurat, Kondisi kesehatan; `allowEdit` | 87 |
| `belajar`, `belajar-bareng-uts` | Aulia; Raka Edit | scheduled (opens 12 Oct), 2025 | 0 |
| `welpar`, `feedback-welpar-2025` | Salsa; Raka Lihat jawaban | closed, 2025, requests nothing | 96 |
| `suara`, `evaluasi-tengah-periode` | Dimas | open, 2023–2025, requests nothing | 214 |
| `ta`, `rencana-ta-2023` | Dimas | open, 2023 only | 41 |
| `wisuda`, `daftar-panitia-wisuda-oktober` | Raka | draft | 0 |
| `pixel`, `pixel-analisis-kondisi-2025` | none (made before the builder) | open, 2025 (its member side is the old fixture) | in Live Counting's fixture |

- Nadia (anggota, 2025) hasn't given Kondisi kesehatan, which Makrab requests (the agreement step's missing detail).
  Raka (pengurus, admin) has every detail. `db.memberDetails` holds the persona's.
- **`GET /api/form` lists only PIXEL** unless a test sets `db.listStoredForms = true`, so screens that show the form
  list keep their references until the member's list is rebuilt. Every other route reads `db.formStore` always.
- The read routes are defaults. Writes are opt-in, as everywhere: `api.on('POST /api/form/:formId/response',
  writes.submitForm)`, `writes.changeFormResponse`, `writes.updateMyDetails`, `writes.createForm`, `writes.updateForm`,
  `writes.publishForm`, `writes.deleteForm`, `writes.renameFormSlug`, `writes.setFormAccess`,
  `writes.removeFormAccess`.
- A file uploaded through the pretend API (`writes.presign`, an address under `/__e2e__/media/`) counts as stored.
- The persona's roles change what the builder shows: `test.use({ roles: { only: ['akademik'] } })` makes Raka a
  pengurus without admin (Welcoming Party is then Lihat jawaban).
- `apps/web/tests/e2e-forms.test.ts` holds these answers to the API's.

## What the web side still owns

- The capability for Kelola › Form (any role) in `apps/web/src/lib/capabilities.ts`, with its row in
  `tests/capabilities.test.ts` read from `route-access.ts` (`POST /api/form`).
- The words: labels for fields and kinds, problem messages, "Lainnya", every sentence, in `apps/web/src/copy/`.
- Drafts of answers stay on the device, as today's form does.
