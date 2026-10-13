/**
 * Why each "different" locked screen differs, checked by hand (F1 part 2, on the run after C1). `review fidelity`
 * first looks for a reason in the owner's report's Deviations (`deviationFor`, a text search); many owners gave the
 * reason in their report's Tests section instead, with the score, so the text search missed it. Each entry here was
 * read against that report and against the side-by-side itself. A note here wins over the text search, because the
 * search can match an outdated line (i-push-dialog's "isn't captured").
 *
 * A screen with neither a note nor a matching deviation stays "unexplained", which is a finding.
 */
export interface FidelityNote {
  /** Locked screen names, as in the fidelity report. */
  screens: string[];
  reason: string;
  /** Where the owner says it, or "F1, by hand" when no report names this screen. */
  source: string;
}

const both = (...keys: string[]) =>
  keys.flatMap((k) => [`${k}-light`, `${k}-dark`]);

const TEXT =
  'the locked screens were rendered on Linux and the app on the Mac, and the app self-hosts Geist from npm (P0-A deviation), so text is 1–2 px off and some lines wrap differently';

export const FIDELITY_NOTES: FidelityNote[] = [
  {
    screens: both(
      'phone-anggota-pengumuman',
      'tablet-anggota-pengumuman',
      'phone-pengurus-pengumuman',
      'tablet-pengurus-pengumuman',
      'phone-anggota-post',
      'tablet-anggota-post',
      'phone-anggota-tulis',
      'phone-anggota-pop-react',
      'tablet-anggota-pop-react',
      'phone-anggota-pop-menu',
      'tablet-anggota-pop-menu',
      'phone-pengurus-pop-menu-own',
      'tablet-pengurus-pop-menu-own',
    ).concat(['i-compose-anggota', 'i-filter-sheet']),
    reason: `Matches element for element: ${TEXT}. Touch menus sit about 5 px lower because the trigger has the 44 px hit area; the post shows 3 unread where the locked screen shows 4; the search placeholder is "Cari judul atau isi" (deviation 1).`,
    source: 'P1-B-pengumuman.md, Tests ("Fidelity") and Deviations 1',
  },
  {
    screens: ['i-desk-own-menu'],
    reason: `The menu, the post and the list match. The locked capture still shows the prototype's persona toast ("Melihat sebagai Raka…"), and the search placeholder is "Cari judul atau isi" (P1-B deviation 1); ${TEXT}.`,
    source: 'F1, by hand; P1-B-pengumuman.md, Deviations 1',
  },
  {
    screens: both(
      'phone-anggota-dingdong',
      'phone-anggota-testi-list',
      'phone-anggota-testi-course',
      'phone-anggota-lomba',
    ),
    reason: `The phone pairs line up row for row: ${TEXT}. On Info Lomba that rewraps Gemastik's tags onto two lines instead of three and moves the cards below.`,
    source: 'P2-B-services.md, Tests ("Fidelity per screen")',
  },
  {
    screens: both(
      'phone-anggota-matkul-add',
      'phone-anggota-notif',
      'phone-pengurus-layanan',
    ),
    reason: `The content matches; the difference is the phone tab bar and, on Tambah mata kuliah, the Tambahkan button a few pixels wider; ${TEXT}.`,
    source:
      'P1-C-profil-layanan.md, Tests ("Owned fidelity captures after round 2")',
  },
  {
    screens: both('phone-pengurus-live'),
    reason:
      'The locked capture caught the live square mid-blink (hidden) while the harness stops animation, and the Semua link is new.',
    source:
      'P3-A-kelola-live.md, Tests ("Fidelity") and "Known fidelity differences"',
  },
  {
    screens: both('phone-pengurus-ov-addev', 'tablet-pengurus-ov-addev'),
    reason:
      'The default date is the day chosen in Kalender, the date and time inputs render in id-ID, the first field shows its focus ring, and the Select has P0-A’s chevron in place of the browser’s arrow.',
    source:
      'P3-B-manage.md, Tests (side-by-sides table) and Deviations 3, 4 and 7',
  },
  {
    screens: ['i-form-draft-restored'],
    reason: `Matches field for field, with "Draf tersimpan" and the restored answers; ${TEXT}.`,
    source: 'F1, by hand; P2-A-form-sparta.md, Tests (0.923 after round 2)',
  },
  {
    screens: ['system-kit', 'system-cards'],
    reason:
      'The gallery’s #kit and #sys against the prototype’s design-system page: the same cards; the self-hosted fonts render a few words 1–2 px wider or narrower, so some lines wrap differently and #sys is about 35 px shorter (a size mismatch).',
    source:
      'P0-A-design-system.md, Deviations ("Fonts come from npm") and Tests',
  },
  {
    screens: ['i-push-dialog'],
    reason:
      'The prompt matches. The locked capture was taken after the prototype’s scripted form flow (garis-check.mjs 4c), so its Beranda has no PIXEL form row and still shows the toast "Form berhasil dikirim!"; Nadia hasn’t sent the form in the app’s capture.',
    source: 'F1, by hand (mapped by F1 in ebd43d4)',
  },
];

/** The note for a screen, if any. */
export const noteFor = (name: string) =>
  FIDELITY_NOTES.find((n) => n.screens.includes(name)) ?? null;
