// Tautan pendek's rules with no database (src/lib/short-link.ts, src/lib/click-counter.ts), and the s.hmif.dev host:
// every request there is a redirect, and no API route answers on it.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { createClickCounter } from '../src/lib/click-counter';
import {
  afterWrongTry,
  CLAIM_LOCK_MS,
  claimOpen,
  destinationProblem,
  isShortHost,
  nameCandidates,
  nameProblem,
  nimFromAccount,
  ownerPush,
  pickRedirect,
  randomName,
  redirectAnswer,
  tidyName,
  unreachableReason,
  type RedirectRow,
} from '../src/lib/short-link';

const WEB = 'https://app.hmif.dev';

const row = (name: string, o: Partial<RedirectRow> = {}): RedirectRow => ({
  name,
  folded: name.toLowerCase(),
  linkId: `l-${name}`,
  destination: `https://example.com/${name}`,
  formId: null,
  formName: null,
  deleted: false,
  ...o,
});

test('one rule for new names: the field’s messages, in its order', () => {
  assert.equal(nameProblem('makrab-2026'), null);
  assert.equal(nameProblem('BayarKasHMIF'), null);
  assert.equal(nameProblem('Catatan_PTI'), 'characters');
  assert.equal(nameProblem('LowonginAja!'), 'characters');
  assert.equal(nameProblem('ab'), 'too_short');
  assert.equal(nameProblem('a!'), 'characters');
  assert.equal(nameProblem('a'.repeat(50)), null);
  assert.equal(nameProblem('a'.repeat(51)), 'too_long');
  for (const v of ['-abc', 'abc-', 'ab--c'])
    assert.equal(nameProblem(v), 'hyphens', v);
  assert.equal(tidyName('  Bukber  Pixel 25 '), 'Bukber-Pixel-25');
});

test('a random name is six letters or digits a poster can’t confuse', () => {
  for (let i = 0; i < 200; i++) {
    const n = randomName();
    assert.match(n, /^[a-km-np-z2-9]{6}$/);
    assert.equal(nameProblem(n), null);
  }
});

test('a destination is a whole http(s) address, never s.hmif.dev itself', () => {
  assert.equal(
    destinationProblem('https://docs.google.com/forms/d/x', 's.hmif.dev'),
    null,
  );
  assert.equal(destinationProblem(' http://example.com ', 's.hmif.dev'), null);
  for (const v of [
    '',
    'docs.google.com/x',
    'javascript:alert(1)',
    'ftp://example.com/x',
    'https://localhost/x',
    'https://user:pass@example.com/',
    'https://exa mple.com',
  ])
    assert.equal(destinationProblem(v, 's.hmif.dev'), 'invalid', v);
  assert.equal(
    destinationProblem('https://s.hmif.dev/abc', 's.hmif.dev'),
    'self',
  );
  assert.equal(
    destinationProblem('https://S.HMIF.DEV/abc', 's.hmif.dev'),
    'self',
  );
});

test('the host split compares the Host header without its port or capitals', () => {
  assert.equal(isShortHost('s.hmif.dev', 's.hmif.dev'), true);
  assert.equal(isShortHost('S.hmif.dev:443', 's.hmif.dev'), true);
  assert.equal(isShortHost('s.localhost:4771', 's.localhost'), true);
  assert.equal(isShortHost('app-api.hmif.dev', 's.hmif.dev'), false);
  assert.equal(isShortHost(undefined, 's.hmif.dev'), false);
});

test('names a request may mean: the raw target, decoded, then the path alone', () => {
  assert.deepEqual(nameCandidates('makrab'), ['makrab']);
  assert.deepEqual(nameCandidates('Daftar%20Bukber'), [
    'Daftar%20Bukber',
    'Daftar Bukber',
  ]);
  // The old service matched the raw path with its query: a name with ? lives there.
  assert.deepEqual(nameCandidates('apa?ini'), ['apa?ini', 'apa']);
  assert.deepEqual(nameCandidates('makrab?utm_source=ig'), [
    'makrab?utm_source=ig',
    'makrab',
  ]);
  assert.deepEqual(nameCandidates('%C2%BFque'), ['%C2%BFque', '¿que']);
  assert.deepEqual(nameCandidates('bad%zz'), ['bad%zz']);
  assert.deepEqual(nameCandidates(''), []);
});

test('the redirect’s order: an exact name first, then the one name that matches without capitals', () => {
  const rows = [row('Makrab'), row('makrab'), row('Bukber')];
  assert.equal(pickRedirect(rows, ['Makrab'])?.name, 'Makrab');
  assert.equal(pickRedirect(rows, ['makrab'])?.name, 'makrab');
  // Twins: neither is chosen by capitals alone.
  assert.equal(pickRedirect(rows, ['MAKRAB']), null);
  assert.equal(pickRedirect(rows, ['bukber'])?.name, 'Bukber');
  // An exact later candidate beats a match without capitals on an earlier one.
  assert.equal(
    pickRedirect([row('apa?ini'), row('APA')], ['apa?ini', 'apa'])?.name,
    'apa?ini',
  );
  // Two names of one link that differ in capitals are still that one link.
  assert.equal(
    pickRedirect(
      [row('Old', { linkId: 'l1' }), row('OLD', { linkId: 'l1' })],
      ['old'],
    )?.linkId,
    'l1',
  );
});

test('where a request goes: destination, form, the list, or the not-found page', () => {
  assert.deepEqual(redirectAnswer('makrab', row('makrab'), WEB), {
    kind: 'link',
    location: 'https://example.com/makrab',
    linkId: 'l-makrab',
  });
  assert.deepEqual(
    redirectAnswer(
      'Makrab-2026',
      row('makrab-2026', {
        destination: null,
        formId: 'f1',
        formName: 'makrab-2026',
      }),
      WEB,
    ),
    { kind: 'link', location: `${WEB}/f/makrab-2026`, linkId: 'l-makrab-2026' },
  );
  const notFound = (target: string, r: RedirectRow | null = null) =>
    redirectAnswer(target, r, WEB);
  assert.deepEqual(notFound('makrab-2027'), {
    kind: 'not_found',
    location: `${WEB}/tautan-tidak-ditemukan?nama=makrab-2027`,
  });
  assert.equal(
    notFound('gone', row('gone', { deleted: true })).kind,
    'not_found',
  );
  assert.equal(
    notFound('ftp', row('ftp', { destination: 'ftp://example.com/x' })).kind,
    'not_found',
  );
  assert.equal(
    notFound('js', row('js', { destination: 'javascript:alert(1)' })).kind,
    'not_found',
  );
  for (const t of ['', '?utm=x', 'dash', 'dash/links', 'DASH'])
    assert.deepEqual(notFound(t), {
      kind: 'app',
      location: `${WEB}/layanan/tautan`,
    });
  // A link that happens to be named like the old dashboard still opens.
  assert.equal(redirectAnswer('dash', row('dash'), WEB).kind, 'link');
  // A destination with characters a header can't carry goes as a browser would send it.
  assert.equal(
    (
      redirectAnswer(
        'u',
        row('u', { destination: 'https://example.com/ü ü' }),
        WEB,
      ) as {
        location: string;
      }
    ).location,
    'https://example.com/%C3%BC%20%C3%BC',
  );
});

test('old names no browser can send are told apart from those that work', () => {
  for (const n of [
    'makrab',
    'Catatan_PTI',
    'a b',
    'apa?',
    'x&y=z',
    '¿que',
    '[a]',
    'a/b',
  ])
    assert.equal(unreachableReason(n), null, n);
  for (const n of [
    '',
    'a#b',
    ' lead',
    'trail ',
    'a\\b',
    'a/../b',
    '.',
    'tab\tx',
  ])
    assert.notEqual(unreachableReason(n), null, JSON.stringify(n));
});

test('a NIM found in an old account: eight digits in the email first, then the username', () => {
  assert.equal(nimFromAccount('13525901@std.stei.itb.ac.id', 'x'), '13525901');
  assert.equal(
    nimFromAccount('nadia@example.com', 'nadia13525902'),
    '13525902',
  );
  assert.equal(nimFromAccount('n.135259031@example.com', 'abc'), null);
  assert.equal(nimFromAccount(null, 'arkav.panitia'), null);
});

test('five wrong passwords in a row lock 15 minutes; older tries are forgotten', () => {
  const t0 = new Date('2026-12-02T03:00:00Z');
  let lock = afterWrongTry(null, t0);
  for (let i = 2; i <= 4; i++) {
    lock = afterWrongTry(lock, new Date(t0.getTime() + i * 1000));
    assert.equal(lock.tries, i);
    assert.equal(lock.lockedUntil, null);
  }
  const fifth = new Date(t0.getTime() + 5000);
  lock = afterWrongTry(lock, fifth);
  assert.equal(lock.lockedUntil?.getTime(), fifth.getTime() + CLAIM_LOCK_MS);
  const later = afterWrongTry(
    { tries: 4, lastTryAt: t0, lockedUntil: null },
    new Date(t0.getTime() + CLAIM_LOCK_MS + 1),
  );
  assert.equal(later.tries, 1);
});

test('claiming is open until the end the setting names, or always with none', () => {
  const until = new Date('2027-03-01T16:59:00Z');
  assert.equal(claimOpen(until, new Date('2027-03-01T16:58:00Z')), true);
  assert.equal(claimOpen(until, new Date('2027-03-01T17:00:00Z')), false);
  assert.equal(claimOpen(undefined, new Date('2030-01-01')), true);
});

test('the owner’s pushes use the prototype’s words and open the link’s page', () => {
  const moved = ownerPush(
    {
      kind: 'moved',
      linkId: 'l1',
      name: 'jadwal-piket-sekre',
      to: 'Bima Santoso',
    },
    's.hmif.dev',
  );
  assert.equal(moved.title, 'Tautanmu dipindahkan');
  assert.equal(
    moved.options?.body,
    'Admin HMIF memindahkan s.hmif.dev/jadwal-piket-sekre ke Bima Santoso. Alamatnya tetap bisa dibuka.',
  );
  assert.deepEqual(moved.options?.data, { url: '/layanan/tautan/l1' });
  const deleted = ownerPush(
    { kind: 'deleted', linkId: 'l2', name: 'PixelStudyGroup' },
    's.hmif.dev',
  );
  assert.equal(deleted.title, 'Tautanmu dihapus');
  assert.equal(
    deleted.options?.body,
    'Admin HMIF menghapus s.hmif.dev/PixelStudyGroup. Alamat ini tidak bisa dibuka lagi.',
  );
  assert.equal(
    ownerPush({ kind: 'destination', linkId: 'l3', name: 'a-b' }, 's.hmif.dev')
      .options?.body,
    'Admin HMIF mengubah tujuan s.hmif.dev/a-b.',
  );
  const renamed = ownerPush(
    { kind: 'renamed', linkId: 'l4', name: 'baru', from: 'lama' },
    's.hmif.dev',
  );
  assert.equal(renamed.title, 'Tautanmu diubah');
  assert.equal(
    renamed.options?.body,
    'Admin HMIF mengganti nama s.hmif.dev/lama jadi s.hmif.dev/baru. Alamat lama tetap bisa dibuka.',
  );
});

test('clicks are written together, and a failed write keeps them for the next', async () => {
  const writes: Array<Map<string, number>> = [];
  let fail = true;
  const errors: unknown[] = [];
  const counter = createClickCounter({
    write: async (m) => {
      if (fail) throw new Error('down');
      writes.push(m);
    },
    intervalMs: 60_000,
    onError: (e) => errors.push(e),
  });
  counter.add('a');
  counter.add('a');
  counter.add('b');
  await counter.flush();
  assert.equal(errors.length, 1);
  assert.deepEqual(
    [...counter.pending()],
    [
      ['a', 2],
      ['b', 1],
    ],
  );
  fail = false;
  counter.add('a');
  await counter.flush();
  assert.deepEqual(
    [...writes[0]],
    [
      ['a', 3],
      ['b', 1],
    ],
  );
  assert.equal(counter.pending().size, 0);
});

// The host split, through the whole app with a fake lookup.

let app: {
  request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};
const clicked: string[] = [];
let lookups = 0;
let failLookup = false;

before(async () => {
  usePlaceholderEnv();
  const { createApp } = await import('../src/app');
  const rows = [
    row('makrab'),
    row('Makrab'),
    row('Bukber'),
    row('Daftar Bukber'),
    row('apa?ini'),
    row('gone', { deleted: true }),
    row('form-x', { destination: null, formId: 'f1', formName: 'Form-X' }),
  ];
  app = createApp({
    shortLinks: {
      findRows: async (candidates) => {
        lookups++;
        if (failLookup) throw new Error('database down');
        const folded = candidates.map((c) => c.toLowerCase());
        return rows.filter(
          (r) => candidates.includes(r.name) || folded.includes(r.folded),
        );
      },
      clicks: { add: (id) => clicked.push(id) },
    },
    shortLinkSettings: () => ({ shortHost: 's.hmif.dev', webAppUrl: WEB }),
  });
});

const onShort = async (path: string, init: RequestInit = {}) =>
  await app.request(`http://s.hmif.dev${path}`, {
    ...init,
    headers: { host: 's.hmif.dev', ...(init.headers ?? {}) },
  });

test('on s.hmif.dev a name redirects, uncached, and counts one click', async () => {
  clicked.length = 0;
  const res = await onShort('/makrab');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://example.com/makrab');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(clicked, ['l-makrab']);
  assert.equal(
    (await onShort('/MAKRAB')).headers.get('location'),
    `${WEB}/tautan-tidak-ditemukan?nama=MAKRAB`,
  );
  assert.equal(
    (await onShort('/bukber')).headers.get('location'),
    'https://example.com/Bukber',
  );
  assert.equal(
    (await onShort('/Daftar%20Bukber')).headers.get('location'),
    'https://example.com/Daftar Bukber'.replace(' ', '%20'),
  );
  assert.equal(
    (await onShort('/apa?ini')).headers.get('location'),
    'https://example.com/apa?ini',
  );
  assert.equal(
    (await onShort('/form-x')).headers.get('location'),
    `${WEB}/f/Form-X`,
  );
  assert.equal(
    (await onShort('/gone')).headers.get('location'),
    `${WEB}/tautan-tidak-ditemukan?nama=gone`,
  );
  assert.equal(
    (await onShort('/')).headers.get('location'),
    `${WEB}/layanan/tautan`,
  );
  assert.equal(
    (await onShort('/dash/links')).headers.get('location'),
    `${WEB}/layanan/tautan`,
  );
});

test('HEAD works and counts nothing; other methods are refused', async () => {
  clicked.length = 0;
  const head = await onShort('/makrab', { method: 'HEAD' });
  assert.equal(head.status, 302);
  assert.equal(head.headers.get('location'), 'https://example.com/makrab');
  assert.deepEqual(clicked, []);
  assert.equal((await onShort('/makrab', { method: 'POST' })).status, 405);
});

test('no API route answers on s.hmif.dev, and the API’s own host redirects no name', async () => {
  for (const path of [
    '/health',
    '/api/me',
    '/api/short-links',
    '/doc',
    '/mcp',
    '/robots.txt',
  ])
    assert.equal((await onShort(path)).status, 302, path);
  const before = lookups;
  const own = await app.request('http://app-api.hmif.dev/makrab', {
    headers: { host: 'app-api.hmif.dev' },
  });
  assert.notEqual(own.status, 302);
  assert.equal(lookups, before);
  assert.equal(
    (
      await app.request('http://app-api.hmif.dev/', {
        headers: { host: 'app-api.hmif.dev' },
      })
    ).status,
    200,
  );
});

test('a lookup that fails says try again, uncached, rather than not found', async () => {
  failLookup = true;
  try {
    const res = await onShort('/makrab');
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  } finally {
    failLookup = false;
  }
});
