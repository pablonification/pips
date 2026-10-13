// P3-B: Tambah lomba and Ubah lomba's rules (brief rule 6), under a device zone that isn't WIB.
process.env.TZ = 'America/New_York';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Competition } from '../src/api/generated';
import {
  changedFields,
  draftOfLomba,
  firstLombaError,
  isCompleteUrl,
  lombaBody,
  newLombaDraft,
  priceValue,
  validateLomba,
  type LombaDraft,
} from '../src/features/kelola-lomba/rules';

// Kamis, 8 Oktober 2026, 13.35 WIB (the harness's clock).
const NOW = Date.parse('2026-10-08T06:35:00.000Z');

const filled = (over: Partial<LombaDraft> = {}): LombaDraft => ({
  ...newLombaDraft('2026-10-08'),
  name: 'Hology 8',
  organizer: 'Universitas Brawijaya',
  categories: ['UI/UX'],
  closeDate: '2026-10-20',
  registrationUrl: 'hology.ub.ac.id/daftar',
  sourceUrl: 'https://instagram.com/hology',
  ...over,
});

test('a new draft opens today at 00.00 and closes at 23.59 on a day still to choose', () => {
  assert.deepEqual(newLombaDraft('2026-10-08'), {
    name: '',
    organizer: '',
    categories: [],
    openDate: '2026-10-08',
    openTime: '00:00',
    closeDate: '',
    closeTime: '23:59',
    price: '',
    registrationUrl: '',
    sourceUrl: '',
  });
});

test('validation: every error, and focus on the first', () => {
  assert.deepEqual(validateLomba(filled(), NOW), {});
  const empty = validateLomba(newLombaDraft('2026-10-08'), NOW);
  assert.deepEqual(empty, {
    name: 'Tulis minimal 3 huruf.',
    organizer: 'Tulis minimal 3 huruf.',
    close: 'Isi tanggal dan jamnya.',
    registrationUrl: 'Tulis tautan yang lengkap, misalnya https://….',
    sourceUrl: 'Tulis tautan yang lengkap, misalnya https://….',
  });
  assert.equal(firstLombaError(empty), 'name');
  assert.deepEqual(validateLomba(filled({ name: ' AB ' }), NOW), {
    name: 'Tulis minimal 3 huruf.',
  });
  assert.deepEqual(validateLomba(filled({ openTime: '' }), NOW), {
    open: 'Isi tanggal dan jamnya.',
  });
  // Closing before (or when) it opens.
  assert.deepEqual(
    validateLomba(
      filled({ openDate: '2026-10-21', closeDate: '2026-10-20' }),
      NOW,
    ),
    { close: 'Penutupan harus setelah pembukaan.' },
  );
  // Already closed: Info Lomba lists only open competitions.
  assert.deepEqual(
    validateLomba(
      filled({
        openDate: '2026-10-01',
        closeDate: '2026-10-08',
        closeTime: '13:30',
      }),
      NOW,
    ),
    { close: 'Pendaftaran yang sudah tutup tidak akan tampil.' },
  );
  assert.deepEqual(
    validateLomba(filled({ closeDate: '2026-10-08', closeTime: '13:40' }), NOW),
    {},
  );
  assert.deepEqual(validateLomba(filled({ price: 'Rp50.000' }), NOW), {
    price: 'Tulis angka saja, misalnya 150000.',
  });
  assert.deepEqual(validateLomba(filled({ sourceUrl: 'gemastik' }), NOW), {
    sourceUrl: 'Tulis tautan yang lengkap, misalnya https://….',
  });
});

test('links: https:// is added when there is no scheme; then they must be complete', () => {
  assert.equal(isCompleteUrl('gemastik.kemdikbud.go.id'), true);
  assert.equal(isCompleteUrl('http://hology.ub.ac.id'), true);
  assert.equal(isCompleteUrl('https://'), false);
  assert.equal(isCompleteUrl('lomba'), false);
  assert.equal(isCompleteUrl('   '), false);
  assert.equal(isCompleteUrl('javascript:alert(1)'), false);
});

test('the fee: null when empty or 0, else the whole number as a string', () => {
  assert.equal(priceValue(''), null);
  assert.equal(priceValue('  '), null);
  assert.equal(priceValue('0'), null);
  assert.equal(priceValue('000'), null);
  assert.equal(priceValue('150000'), '150000');
  assert.equal(priceValue('0150000'), '150000');
});

test('the POST body: trimmed, WIB times as ISO, https:// added, no posters', () => {
  assert.deepEqual(lombaBody(filled({ name: ' Hology 8 ', price: '150000' })), {
    name: 'Hology 8',
    organizer: 'Universitas Brawijaya',
    categories: ['UI/UX'],
    registrationStart: '2026-10-07T17:00:00.000Z',
    registrationDeadline: '2026-10-20T16:59:00.000Z',
    price: '150000',
    registrationUrl: 'https://hology.ub.ac.id/daftar',
    sourceUrl: 'https://instagram.com/hology',
  });
  assert.equal(lombaBody(filled()).price, null);
});

const gemastik: Competition = {
  id: 'l1',
  name: 'Gemastik XIX',
  organizer: 'Puspresnas',
  registrationStart: '2026-09-01T00:00:00.000Z',
  registrationDeadline: '2026-10-14T16:59:00.000Z',
  price: '150000',
  sourceUrl: 'https://gemastik.kemdikbud.go.id/info',
  registrationUrl: 'https://gemastik.kemdikbud.go.id',
  categories: ['Competitive Programming', 'UI/UX'],
  createdAt: '2026-09-01T00:00:00.000Z',
  medias: [],
};

test('Ubah lomba: filled in WIB; only what changed is sent, never mediaUrls', () => {
  const d = draftOfLomba(gemastik);
  assert.deepEqual(d, {
    name: 'Gemastik XIX',
    organizer: 'Puspresnas',
    categories: ['Competitive Programming', 'UI/UX'],
    openDate: '2026-09-01',
    openTime: '07:00',
    closeDate: '2026-10-14',
    closeTime: '23:59',
    price: '150000',
    registrationUrl: 'https://gemastik.kemdikbud.go.id',
    sourceUrl: 'https://gemastik.kemdikbud.go.id/info',
  });
  assert.deepEqual(changedFields(gemastik, d), {});
  assert.deepEqual(
    changedFields(gemastik, {
      ...d,
      price: '',
      categories: ['UI/UX', 'Competitive Programming'],
      closeTime: '20:00',
    }),
    { registrationDeadline: '2026-10-14T13:00:00.000Z', price: null },
  );
  assert.equal(
    'mediaUrls' in changedFields(gemastik, { ...d, name: 'X' }),
    false,
  );
  // A free one stored as "0" or null opens with an empty fee.
  assert.equal(draftOfLomba({ ...gemastik, price: '0' }).price, '');
  assert.equal(draftOfLomba({ ...gemastik, price: null }).price, '');
  assert.deepEqual(
    changedFields({ ...gemastik, price: '0' }, { ...d, price: '' }),
    {},
  );
});
