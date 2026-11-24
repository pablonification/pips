# Tautan pendek: the API

s.hmif.dev inside PIPS! (decision 24). Every route is under `/api`, signed in; who may call each is in
`apps/api/src/lib/route-access.ts`. Words: a **link** has one current **name** (`s.hmif.dev/<name>`) and may have
**older names**, which keep opening it; a **form's link** is a published form's address on s.hmif.dev; an **old
account** is an account of the old service whose links can be **matched** (by email or NIM) or **claimed** (with its
password). The rules live in `apps/api/src/lib/short-link.ts`.

## Names

One rule for every new or renamed name, a link's or a form's: letters, numbers and hyphens, a hyphen only between
letters or numbers, 3 to 50 characters. The field turns spaces into hyphens and keeps capitals. Names are **compared
without capitals**: a new `Makrab` is refused while `makrab` exists as a link, a form, an older name or a deleted
one. Old names that break the rule (`Catatan_PTI`, `LowonginAja!`) keep working and can be kept; a rename follows it.

Problems, in the order the field shows them, and the prototype's words for each:

| `problem` | Words | Status on save |
| --- | --- | --- |
| `characters` | Hanya huruf, angka, dan tanda hubung | 400 |
| `too_short` | Minimal 3 karakter | 400 |
| `too_long` | Maksimal 50 karakter (sekarang N) | 400 |
| `hyphens` | Tanda hubung hanya di antara huruf atau angka | 400 |
| `taken` | Sudah dipakai tautan lain sebagai `heldAs` (or form lain, by `heldBy`; without "sebagai" when `heldAs` equals the name typed) | 409 |
| `used` | Nama ini sudah pernah dipakai (never says whose) | 409 |

## Routes

| Route | Who | Body / query | Answer |
| --- | --- | --- | --- |
| `GET /short-links?search=&order=new\|clicks&limit=50&offset=0` | member | | `{ links, total, claim: { open, until } }`. The member's links and the links of forms they made and published (marked by `form`), newest made first or most clicked. `search` matches the name, destination or form title. `claim.until` is null while no end is set; hide every way into claiming when `open` is false. |
| `POST /short-links` | member | `{ destination, name? }` | 201, the link (as `GET /short-links/{id}`). No name: six random letters and digits. 400 `{ destination: 'invalid' \| 'self' }` (Tulis alamat lengkap, diawali https:// / Ini sudah tautan s.hmif.dev) or a name `problem`; 409 `taken`/`used` with `heldAs`, `heldBy`. |
| `GET /short-links/name-check?name=&linkId=` | member | the name as typed; `linkId` when renaming | `{ name, available, problem, heldAs, heldBy }`, `name` tidied. About 300 ms after the last key; saving still decides. A link's own older names are free to it. |
| `GET /short-links/{id}` | the holder (a form's link: its maker), admin | | `{ state, id, name, olderNames, destination, form, clicks, createdAt, updatedAt, canEdit, owner, oldAccount, movedTo }`. `olderNames` newest first. `canEdit` false for a form's link ("Buka formnya"). For admin, `owner` and `oldAccount: { username, otherUnclaimed }` ("Juga 2 tautan lain dari akun lama …"). For the last holder after an admin's change: `state: 'moved'` with `movedTo` (Tautan ini sudah dipindahkan) or `'deleted'` (Tautan ini sudah dihapus). 404 for anyone else. |
| `PATCH /short-links/{id}` | the holder, admin | `{ destination }` | The link. Tujuan diubah. 409 for a form's link. |
| `PUT /short-links/{id}/name` | the holder, admin | `{ name }` | The link, its old name now in `olderNames`. Nama diubah. Alamat lama tetap bisa dibuka. 400/409 as above; 409 for a form's link. |
| `DELETE /short-links/{id}` | the holder, admin | | 204. It stops opening and its names are never given out again. 409 for a form's link. |
| `GET /short-links/all?search=&view=all\|unclaimed&order=&limit=&offset=` | admin | | `{ links, total, accounts }`: each link with `owner` (`{ id, fullName, nim }`, a form's maker for a form's link) or `oldAccount` (the username, when nobody holds it). `search` also matches the holder's name or NIM and the old username. `accounts` counts the old accounts behind Belum diambil. |
| `POST /short-links/{id}/give` | admin | `{ nim, withAccount }` | `{ moved, link }`. Berikan ke anggota / Pindahkan, to the member with that NIM (find them with NIM Finder); `withAccount` also moves the old account's other links nobody holds. 400 for an unknown NIM, 409 for a form's link. |
| `POST /short-links/claim/lookup` | member | `{ login, password }` | `{ state, account, links, claimedAt, token }`: `found` (the links that would move, and a token for 10 minutes), `empty` (Akun ini tidak punya tautan), `taken` (Tautan akun ini sudah diambil, `claimedAt`; never who), `mine` (Tautan akun ini sudah ada di daftarmu), `two_factor` (the account had two-step sign-in: an admin moves its links). 401 `{ triesLeft }` for a wrong username or password, the same either way ("Sisa N percobaan" from the third). 429 `{ until }` after five (Terlalu banyak percobaan. Coba lagi pukul HH.MM). 410 once claiming has ended. |
| `POST /short-links/claim` | member | `{ token }` | `{ moved }` (N tautan sekarang milikmu). 400 when the token is stale or another member's (look up again), 409 when someone claimed it first, 410 after the end. |

Forms: `GET /form/{formId}/slug-check` and `PUT /form/{formId}/slug` answer the same `problem`s plus `heldAs` and
`heldBy`, and a published form keeps its old names, so "Tautan lama tetap bisa dibuka." is true for forms too.
`GET /form-link/{name}` finds a form by any of its names, exactly or without capitals.

## The redirect

Requests whose `Host` is `SHORTLINK_HOST` (s.hmif.dev) never reach a route. `GET` or `HEAD /<name>` answers 302 with
`Cache-Control: no-store`:

| What the name is | Where it goes |
| --- | --- |
| a link (exact name, raw or percent-decoded, with or without its query; then the one link matching without capitals) | its destination; a click is counted (not for `HEAD`) |
| a form's current or older name | `<web app>/f/<current name>` |
| `/`, `/dash`, `/dash/…` | `<web app>/layanan/tautan` (the member's list; through Masuk if signed out) |
| unknown, deleted, or a destination that isn't http(s) | `<web app>/tautan-tidak-ditemukan?nama=<name>`: the public "Tautan tidak ditemukan" page |

## Pushes to a link's holder

When an admin moves, deletes or changes (destination or name) a member's link, the member gets a web push with no
setting to turn it off. `data.url` is `/layanan/tautan/<id>`, where `GET /short-links/{id}` tells them what happened.

| When | Title | Body |
| --- | --- | --- |
| moved | Tautanmu dipindahkan | Admin HMIF memindahkan s.hmif.dev/<name> ke <member>. Alamatnya tetap bisa dibuka. |
| deleted | Tautanmu dihapus | Admin HMIF menghapus s.hmif.dev/<name>. Alamat ini tidak bisa dibuka lagi. |
| destination | Tautanmu diubah | Admin HMIF mengubah tujuan s.hmif.dev/<name>. |
| renamed | Tautanmu diubah | Admin HMIF mengganti nama s.hmif.dev/<old> jadi s.hmif.dev/<new>. Alamat lama tetap bisa dibuka. |
