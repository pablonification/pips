// Tautan pendek's routes through the controller with fake storage (no database): who may see and change a link, the
// name and destination rules, admin's tools and the pushes they send, and the claim (locks, timing, two-step
// accounts, races). The SQL itself is in tests/db/short-links.test.ts.
import { strict as assert } from 'node:assert';
import { before, beforeEach, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { testUser, type TestUser } from './support/session';
import type { PushData } from '../src/lib/push-manager';
import type { ShortLinkDeps } from '../src/controllers/short-link.controller';
import type { ClaimLock } from '../src/lib/short-link';

const nadia = testUser('u-nadia', { nim: '13525901', fullName: 'Nadia Putri' });
const bima = testUser('u-bima', { nim: '13525902', fullName: 'Bima Santoso' });
const raka = testUser('u-raka', { nim: '13524901', fullName: 'Raka Pratama' });
const ROLES: Record<string, string[]> = { 'u-raka': ['admin', 'akademik'] };
const PEOPLE = [nadia, bima, raka];

interface FakeLink {
  id: string;
  destination: string | null;
  formId: string | null;
  formTitle: string | null;
  formOwnerId: string | null;
  formPublished: boolean;
  ownerId: string | null;
  previousOwnerId: string | null;
  accountId: string | null;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  names: Array<{ name: string; isCurrent: boolean }>;
}

interface FakeAccount {
  id: string;
  lynxId: string;
  username: string;
  email: string | null;
  nim: string | null;
  passwordHash: string | null;
  twoFactor: boolean;
  claimedBy: string | null;
  claimedAt: Date | null;
  claimedVia: 'email' | 'nim' | 'password' | 'admin' | null;
  createdAt: Date;
  updatedAt: Date;
}

let links: Map<string, FakeLink>;
let accounts: Map<string, FakeAccount>;
let locks: Map<string, ClaimLock & { key: string }>;
const pushes: Array<{ userId: string; push: PushData }> = [];
let compares: Array<{ password: string; hash: string }>;
let now: Date;
let claimUntil: Date | undefined;
let nextId = 0;
let claimRace = false;
/** While set, every password comparison waits for it: requests sent at once overlap. */
let compareGate: Promise<void> | null = null;

const T0 = new Date('2026-12-02T03:00:00Z');

function link(o: Partial<FakeLink> & { name: string }): FakeLink {
  const { name, ...rest } = o;
  const l: FakeLink = {
    id: `l${++nextId}`,
    destination: `https://example.com/${name}`,
    formId: null,
    formTitle: null,
    formOwnerId: null,
    formPublished: true,
    ownerId: null,
    previousOwnerId: null,
    accountId: null,
    clicks: 0,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    names: [{ name, isCurrent: true }],
    ...rest,
  };
  links.set(l.id, l);
  return l;
}

function account(o: Partial<FakeAccount> & { username: string }): FakeAccount {
  const a: FakeAccount = {
    id: `a${++nextId}`,
    lynxId: `lx${nextId}`,
    email: null,
    nim: null,
    passwordHash: `hash:rahasia`,
    twoFactor: false,
    claimedBy: null,
    claimedAt: null,
    claimedVia: null,
    createdAt: T0,
    updatedAt: T0,
    ...o,
  };
  accounts.set(a.id, a);
  return a;
}

const current = (l: FakeLink) => l.names.find((n) => n.isCurrent)?.name ?? '';

class NameTaken extends Error {}

function setName(l: FakeLink, name: string) {
  const clash = [...links.values()].some(
    (x) =>
      x.id !== l.id &&
      x.names.some((n) => n.name.toLowerCase() === name.toLowerCase()),
  );
  if (clash) throw new NameTaken();
  for (const n of l.names) n.isCurrent = false;
  const own = l.names.find((n) => n.name.toLowerCase() === name.toLowerCase());
  if (own) {
    own.name = name;
    own.isCurrent = true;
  } else l.names.push({ name, isCurrent: true });
}

let NameTakenError: typeof import('../src/repositories/short-link.repo').NameTakenError;

function fakeDeps(): ShortLinkDeps {
  return {
    getUserRoles: async (id) => (ROLES[id] ?? []) as never[],
    listMemberLinks: async (userId, q) => {
      const rows = [...links.values()]
        .filter(
          (l) =>
            !l.deletedAt &&
            (l.formId
              ? l.formPublished && l.formOwnerId === userId
              : l.ownerId === userId),
        )
        .map((l) => ({
          id: l.id,
          name: current(l),
          destination: l.destination,
          formId: l.formId,
          formTitle: l.formTitle,
          clicks: l.clicks,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          total: 0,
        }));
      return {
        rows: rows.slice(q.offset, q.offset + q.limit),
        total: rows.length,
      };
    },
    countMemberLinks: async () => 0,
    listAllLinks: async () => ({ rows: [], total: 0, accounts: null }),
    getLink: async (id) => {
      const l = links.get(id);
      if (!l) return null;
      return {
        id: l.id,
        destination: l.destination,
        formId: l.formId,
        formTitle: l.formTitle,
        formOwnerId: l.formOwnerId,
        formPublished: l.formPublished,
        ownerId: l.ownerId,
        previousOwnerId: l.previousOwnerId,
        accountId: l.accountId,
        clicks: l.clicks,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        deletedAt: l.deletedAt,
        name: current(l),
        olderNames: l.names
          .filter((n) => !n.isCurrent)
          .map((n) => n.name)
          .reverse(),
      };
    },
    getPerson: async (id) => {
      const p = PEOPLE.find((x) => x.id === id);
      return p ? { id: p.id, fullName: p.fullName, nim: p.nim } : null;
    },
    getMemberByNim: async (nim) => {
      const p = PEOPLE.find((x) => x.nim === nim);
      return p ? { id: p.id, fullName: p.fullName, nim: p.nim } : null;
    },
    getAccount: async (id) => accounts.get(id) ?? null,
    unclaimedAccountLinks: async (accountId) =>
      [...links.values()]
        .filter(
          (l) =>
            l.accountId === accountId &&
            !l.ownerId &&
            !l.deletedAt &&
            !l.formId,
        )
        .map((l) => ({
          id: l.id,
          name: current(l),
          destination: l.destination,
          clicks: l.clicks,
        })),
    nameHolder: async (name, except = {}) => {
      for (const l of links.values()) {
        if (except.linkId && l.id === except.linkId) continue;
        const n = l.names.find(
          (x) => x.name.toLowerCase() === name.toLowerCase(),
        );
        if (!n) continue;
        if (l.deletedAt)
          return { held: 'used', heldAs: n.name, heldBy: 'link' };
        return {
          held: 'taken',
          heldAs: n.name,
          heldBy: l.formId ? 'form' : 'link',
        };
      }
      return null;
    },
    createLink: async ({ destination, ownerId, name }) => {
      const l = link({ name: `tmp-${nextId}`, destination, ownerId });
      l.names = [];
      try {
        setName(l, name);
      } catch {
        links.delete(l.id);
        throw new NameTakenError();
      }
      return l.id;
    },
    setDestination: async (id, destination) => {
      const l = links.get(id)!;
      l.destination = destination;
      l.updatedAt = now;
    },
    renameLink: async (id, name) => {
      try {
        setName(links.get(id)!, name);
      } catch {
        throw new NameTakenError();
      }
    },
    deleteLink: async (id) => {
      links.get(id)!.deletedAt = now;
    },
    giveLink: async ({ linkId, toUserId, withAccount }) => {
      const l = links.get(linkId)!;
      l.previousOwnerId =
        l.ownerId && l.ownerId !== toUserId ? l.ownerId : null;
      l.ownerId = toUserId;
      let moved = 1;
      if (withAccount && l.accountId) {
        for (const x of links.values())
          if (x.accountId === l.accountId && !x.ownerId && !x.deletedAt) {
            x.ownerId = toUserId;
            moved++;
          }
        const a = accounts.get(l.accountId)!;
        if (!a.claimedBy)
          Object.assign(a, { claimedBy: toUserId, claimedVia: 'admin' });
      }
      return moved;
    },
    findAccountsByLogin: async (login) => {
      const l = login.trim().toLowerCase();
      return [...accounts.values()].filter(
        (a) => a.username.toLowerCase() === l || a.email?.toLowerCase() === l,
      );
    },
    claimAccount: async ({ accountId, userId, via }) => {
      const a = accounts.get(accountId)!;
      if (claimRace)
        Object.assign(a, { claimedBy: 'u-someone', claimedAt: now });
      if (a.claimedBy) return null;
      Object.assign(a, { claimedBy: userId, claimedAt: now, claimedVia: via });
      let moved = 0;
      for (const l of links.values())
        if (l.accountId === accountId && !l.ownerId && !l.deletedAt) {
          l.ownerId = userId;
          moved++;
        }
      return moved;
    },
    // As the database does it under row locks: refused while any key is locked, otherwise counted on every key.
    reserveClaimTry: async (keys, at) => {
      const { countTry, lockedUntil } = await import('../src/lib/short-link');
      const until = keys
        .map((k) => lockedUntil(locks.get(k), at))
        .filter((d): d is Date => !!d)
        .sort((x, y) => y.getTime() - x.getTime())[0];
      if (until) return { locked: until };
      const out = new Map<string, ClaimLock>();
      for (const key of keys) {
        const next = countTry(locks.get(key) ?? null, at);
        locks.set(key, { key, ...next });
        out.set(key, next);
      }
      return { locks: out };
    },
    giveBackClaimTry: async (keys) => {
      const { giveBackTry } = await import('../src/lib/short-link');
      for (const key of keys) {
        const lock = locks.get(key);
        if (!lock) continue;
        const next = giveBackTry(lock);
        if (next) locks.set(key, { key, ...next });
        else locks.delete(key);
      }
    },
    // As the database answers it: the most common cost among the old accounts' hashes, the higher on a tie.
    dummyHashCost: async () => {
      const { bcryptCost, CLAIM_DEFAULT_HASH_COST } =
        await import('../src/lib/short-link');
      const counts = new Map<number, number>();
      for (const a of accounts.values()) {
        const cost = bcryptCost(a.passwordHash);
        if (cost !== null) counts.set(cost, (counts.get(cost) ?? 0) + 1);
      }
      const [top] = [...counts].sort((x, y) => y[1] - x[1] || y[0] - x[0]);
      return top?.[0] ?? CLAIM_DEFAULT_HASH_COST;
    },
    notify: async (userId, push) => {
      pushes.push({ userId, push });
    },
    settings: () => ({ shortHost: 's.hmif.dev', claimUntil }),
    now: () => now,
    compare: async (password, hash) => {
      compares.push({ password, hash });
      if (compareGate) await compareGate;
      return hash === `hash:${password}`;
    },
  };
}

let router: Parameters<typeof callRouter>[0];
let createRouter: typeof import('../src/controllers/short-link.controller').createShortLinkRouter;
const as = async (
  user: TestUser | null,
  method: string,
  path: string,
  body?: unknown,
) => await callRouter(router, user, method, path, body);
/** Pushes go out in the background: let them land. */
const settle = async () => await new Promise((r) => setTimeout(r, 10));

before(async () => {
  usePlaceholderEnv();
  ({ NameTakenError } = await import('../src/repositories/short-link.repo'));
  const { createShortLinkRouter } =
    await import('../src/controllers/short-link.controller');
  createRouter = createShortLinkRouter;
  router = createShortLinkRouter(fakeDeps());
});

beforeEach(() => {
  links = new Map();
  accounts = new Map();
  locks = new Map();
  pushes.length = 0;
  compares = [];
  now = T0;
  claimUntil = new Date('2027-03-01T16:59:00Z');
  claimRace = false;
  compareGate = null;
});

test('a member sees their links and their published forms’ links, and the claim window', async () => {
  link({ name: 'bukber-pixel-25', ownerId: nadia.id });
  link({ name: 'kevin-cv', ownerId: bima.id });
  link({
    name: 'makrab-2026',
    destination: null,
    formId: 'f1',
    formTitle: 'Makrab',
    formOwnerId: nadia.id,
  });
  link({
    name: 'draf',
    destination: null,
    formId: 'f2',
    formTitle: 'Draf',
    formOwnerId: nadia.id,
    formPublished: false,
  });
  const res = await as(nadia, 'GET', '/short-links');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.links.map((l: { name: string }) => l.name).sort(), [
    'bukber-pixel-25',
    'makrab-2026',
  ]);
  assert.deepEqual(res.body.claim, {
    open: true,
    until: '2027-03-01T16:59:00.000Z',
  });
  claimUntil = undefined;
  assert.deepEqual((await as(nadia, 'GET', '/short-links')).body.claim, {
    open: true,
    until: null,
  });
  assert.equal((await as(null, 'GET', '/short-links')).status, 401);
});

test('making a link: the destination, the one name rule, names held now or once, a random name', async () => {
  link({ name: 'bukber-pixel-25', ownerId: bima.id });
  link({
    name: 'makrab-2026',
    destination: null,
    formId: 'f1',
    formTitle: 'Makrab',
    formOwnerId: raka.id,
  });
  link({ name: 'oprec-asisten-pti', ownerId: bima.id, deletedAt: T0 });
  const make = async (body: object) =>
    await as(nadia, 'POST', '/short-links', body);

  assert.equal(
    (await make({ destination: 'docs.google.com/x' })).body.destination,
    'invalid',
  );
  assert.equal(
    (await make({ destination: 'https://s.hmif.dev/abc' })).body.destination,
    'self',
  );
  const short = await make({ destination: 'https://example.com', name: 'ab' });
  assert.equal(short.status, 400);
  assert.equal(short.body.problem, 'too_short');
  assert.equal(
    (await make({ destination: 'https://example.com', name: 'Catatan_PTI' }))
      .body.problem,
    'characters',
  );

  const taken = await make({
    destination: 'https://example.com',
    name: 'Bukber-Pixel-25',
  });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.problem, 'taken');
  assert.equal(taken.body.heldAs, 'bukber-pixel-25');
  assert.equal(taken.body.heldBy, 'link');
  const form = await make({
    destination: 'https://example.com',
    name: 'MAKRAB-2026',
  });
  assert.deepEqual(
    [form.status, form.body.heldBy, form.body.heldAs],
    [409, 'form', 'makrab-2026'],
  );
  const used = await make({
    destination: 'https://example.com',
    name: 'Oprec-Asisten-PTI',
  });
  assert.equal(used.status, 409);
  assert.equal(used.body.problem, 'used');
  assert.equal(used.body.heldAs, undefined);

  const made = await make({
    destination: ' https://docs.google.com/forms/d/x ',
    name: 'Rapat Akademik Kamis',
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.name, 'Rapat-Akademik-Kamis');
  assert.equal(made.body.destination, 'https://docs.google.com/forms/d/x');
  assert.equal(made.body.state, 'own');
  assert.equal(made.body.canEdit, true);

  const random = await make({ destination: 'https://example.com/r' });
  assert.equal(random.status, 201);
  assert.match(random.body.name, /^[a-z2-9]{6}$/);
});

test('the name check says what the field shows, and a link’s own older names are free to it', async () => {
  const mine = link({ name: 'slide-pti-k4', ownerId: nadia.id });
  mine.names.unshift({ name: 'slide-pti', isCurrent: false });
  link({ name: 'BayarKasHMIF', ownerId: raka.id });
  const check = async (q: string) =>
    (await as(nadia, 'GET', `/short-links/name-check?${q}`)).body;
  assert.deepEqual(await check('name=bayarkashmif'), {
    name: 'bayarkashmif',
    available: false,
    problem: 'taken',
    heldAs: 'BayarKasHMIF',
    heldBy: 'link',
  });
  assert.equal((await check('name=slide-pti')).problem, 'taken');
  assert.equal(
    (await check(`name=slide-pti&linkId=${mine.id}`)).available,
    true,
  );
  assert.deepEqual(await check('name=Makrab%202027'), {
    name: 'Makrab-2027',
    available: true,
    problem: null,
    heldAs: null,
    heldBy: null,
  });
});

test('a member can’t see or touch another member’s link; admin can', async () => {
  const bimas = link({ name: 'kevin-cv', ownerId: bima.id });
  for (const [method, path, body] of [
    ['GET', `/short-links/${bimas.id}`],
    [
      'PATCH',
      `/short-links/${bimas.id}`,
      { destination: 'https://example.com/x' },
    ],
    ['PUT', `/short-links/${bimas.id}/name`, { name: 'curian' }],
    ['DELETE', `/short-links/${bimas.id}`],
  ] as const)
    assert.equal(
      (await as(nadia, method, path, body)).status,
      404,
      `${method} ${path}`,
    );
  assert.equal(links.get(bimas.id)!.deletedAt, null);
  const seen = await as(raka, 'GET', `/short-links/${bimas.id}`);
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.body.owner, {
    id: bima.id,
    fullName: 'Bima Santoso',
    nim: '13525902',
  });
  assert.equal((await as(nadia, 'GET', '/short-links/nothing')).status, 404);
});

test('renaming keeps the old name, and going back to an older name is allowed', async () => {
  const l = link({ name: 'Catatan_PTI', ownerId: nadia.id });
  const bad = await as(nadia, 'PUT', `/short-links/${l.id}/name`, {
    name: 'Catatan_PTI_2',
  });
  assert.equal(bad.body.problem, 'characters');
  const renamed = await as(nadia, 'PUT', `/short-links/${l.id}/name`, {
    name: 'catatan-pti',
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, 'catatan-pti');
  assert.deepEqual(renamed.body.olderNames, ['Catatan_PTI']);
  // An old name that breaks today's rule can't be typed again, but this one keeps working (it is still a row).
  const again = await as(nadia, 'PUT', `/short-links/${l.id}/name`, {
    name: 'catatan-pti-baru',
  });
  assert.deepEqual(again.body.olderNames, ['catatan-pti', 'Catatan_PTI']);
  const back = await as(nadia, 'PUT', `/short-links/${l.id}/name`, {
    name: 'catatan-pti',
  });
  assert.equal(back.status, 200);
  assert.equal(back.body.name, 'catatan-pti');
  assert.equal(pushes.length, 0);
});

test('a form’s link opens for its maker but is changed only in the form', async () => {
  const f = link({
    name: 'makrab-2026',
    destination: null,
    formId: 'f1',
    formTitle: 'Makrab',
    formOwnerId: nadia.id,
  });
  const seen = await as(nadia, 'GET', `/short-links/${f.id}`);
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.body.form, { id: 'f1', title: 'Makrab' });
  assert.equal(seen.body.canEdit, false);
  assert.equal(
    (
      await as(nadia, 'PATCH', `/short-links/${f.id}`, {
        destination: 'https://example.com',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await as(nadia, 'PUT', `/short-links/${f.id}/name`, {
        name: 'makrab-baru',
      })
    ).status,
    409,
  );
  assert.equal((await as(nadia, 'DELETE', `/short-links/${f.id}`)).status, 409);
  assert.equal(
    (await as(raka, 'POST', `/short-links/${f.id}/give`, { nim: bima.nim }))
      .status,
    409,
  );
  assert.equal((await as(bima, 'GET', `/short-links/${f.id}`)).status, 404);
});

test('admin changing a member’s link tells them by push; their own or an unclaimed one tells nobody', async () => {
  const nadias = link({ name: 'jadwal-piket-sekre', ownerId: nadia.id });
  await as(raka, 'PATCH', `/short-links/${nadias.id}`, {
    destination: 'https://example.com/baru',
  });
  await as(raka, 'PUT', `/short-links/${nadias.id}/name`, {
    name: 'piket-sekre',
  });
  await settle();
  assert.deepEqual(
    pushes.map((p) => [p.userId, p.push.title, p.push.options?.body]),
    [
      [
        nadia.id,
        'Tautanmu diubah',
        'Admin HMIF mengubah tujuan s.hmif.dev/jadwal-piket-sekre.',
      ],
      [
        nadia.id,
        'Tautanmu diubah',
        'Admin HMIF mengganti nama s.hmif.dev/jadwal-piket-sekre jadi s.hmif.dev/piket-sekre. Alamat lama tetap bisa dibuka.',
      ],
    ],
  );
  pushes.length = 0;
  // The same destination again changes nothing and tells nobody.
  await as(raka, 'PATCH', `/short-links/${nadias.id}`, {
    destination: 'https://example.com/baru',
  });
  const rakas = link({ name: 'BankSoalUTS25', ownerId: raka.id });
  await as(raka, 'PATCH', `/short-links/${rakas.id}`, {
    destination: 'https://example.com/r',
  });
  const unclaimed = link({ name: 'SemnasIF25' });
  await as(raka, 'PUT', `/short-links/${unclaimed.id}/name`, {
    name: 'semnas-if-25',
  });
  await as(nadia, 'PATCH', `/short-links/${nadias.id}`, {
    destination: 'https://example.com/sendiri',
  });
  await settle();
  assert.equal(pushes.length, 0);

  const del = await as(raka, 'DELETE', `/short-links/${nadias.id}`);
  assert.equal(del.status, 204);
  await settle();
  assert.equal(pushes[0].push.title, 'Tautanmu dihapus');
  assert.equal(
    pushes[0].push.options?.body,
    'Admin HMIF menghapus s.hmif.dev/piket-sekre. Alamat ini tidak bisa dibuka lagi.',
  );
  assert.deepEqual(pushes[0].push.options?.data, {
    url: `/layanan/tautan/${nadias.id}`,
  });
  // Where the push opens: what happened, once.
  const page = await as(nadia, 'GET', `/short-links/${nadias.id}`);
  assert.equal(page.body.state, 'deleted');
  assert.equal(page.body.name, 'piket-sekre');
  assert.equal(page.body.destination, null);
  assert.equal(
    (await as(bima, 'GET', `/short-links/${nadias.id}`)).status,
    404,
  );
  assert.equal(
    (
      await as(nadia, 'PATCH', `/short-links/${nadias.id}`, {
        destination: 'https://example.com',
      })
    ).status,
    404,
  );
});

test('giving a link: by NIM, optionally with its old account’s other links; the holder is told', async () => {
  const a = account({ username: 'panitia.semnas' });
  const first = link({ name: 'SemnasIF25', accountId: a.id });
  link({ name: 'semnas-rundown', accountId: a.id });
  link({ name: 'semnas-daftar', accountId: a.id });
  const seen = await as(raka, 'GET', `/short-links/${first.id}`);
  assert.deepEqual(seen.body.oldAccount, {
    username: 'panitia.semnas',
    otherUnclaimed: 2,
  });
  assert.equal(seen.body.owner, null);

  assert.equal(
    (
      await as(nadia, 'POST', `/short-links/${first.id}/give`, {
        nim: bima.nim,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await as(raka, 'POST', `/short-links/${first.id}/give`, {
        nim: '13525999',
      })
    ).status,
    400,
  );
  const given = await as(raka, 'POST', `/short-links/${first.id}/give`, {
    nim: nadia.nim,
    withAccount: true,
  });
  assert.equal(given.status, 200);
  assert.equal(given.body.moved, 3);
  assert.equal(accounts.get(a.id)!.claimedBy, nadia.id);
  await settle();
  assert.equal(pushes.length, 0);

  const moved = await as(raka, 'POST', `/short-links/${first.id}/give`, {
    nim: bima.nim,
  });
  assert.equal(moved.body.moved, 1);
  await settle();
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].userId, nadia.id);
  assert.equal(
    pushes[0].push.options?.body,
    'Admin HMIF memindahkan s.hmif.dev/SemnasIF25 ke Bima Santoso. Alamatnya tetap bisa dibuka.',
  );
  const landing = await as(nadia, 'GET', `/short-links/${first.id}`);
  assert.equal(landing.body.state, 'moved');
  assert.equal(landing.body.movedTo, 'Bima Santoso');
  assert.equal(landing.body.destination, null);
  assert.equal(
    (await as(bima, 'GET', `/short-links/${first.id}`)).body.state,
    'own',
  );
  assert.equal((await as(nadia, 'GET', '/short-links')).body.links.length, 2);
});

test('claim: a found account lists its links, and the token moves them to this member only', async () => {
  const a = account({
    username: 'nadia.putri',
    email: 'nadia.putri@example.com',
  });
  link({ name: 'PIXEL-OSKM-Kel12', accountId: a.id, clicks: 96 });
  link({ name: 'kumpul-kelompok-12', accountId: a.id });
  const found = await as(nadia, 'POST', '/short-links/claim/lookup', {
    login: 'Nadia.Putri@example.com',
    password: 'rahasia',
  });
  assert.equal(found.status, 200);
  assert.equal(found.body.state, 'found');
  assert.equal(found.body.account, 'nadia.putri');
  assert.equal(found.body.links.length, 2);
  assert.equal(typeof found.body.token, 'string');
  assert.equal(JSON.stringify(found.body).includes('hash:'), false);
  // Another member can't use the token.
  assert.equal(
    (await as(bima, 'POST', '/short-links/claim', { token: found.body.token }))
      .status,
    400,
  );
  assert.equal(
    (await as(nadia, 'POST', '/short-links/claim', { token: 'x.y.z' })).status,
    400,
  );
  const taken = await as(nadia, 'POST', '/short-links/claim', {
    token: found.body.token,
  });
  assert.deepEqual(taken.body, { moved: 2 });
  assert.equal(accounts.get(a.id)!.claimedVia, 'password');
  assert.equal((await as(nadia, 'GET', '/short-links')).body.links.length, 2);
  // Again: they are already hers.
  const mine = await as(nadia, 'POST', '/short-links/claim/lookup', {
    login: 'nadia.putri',
    password: 'rahasia',
  });
  assert.equal(mine.body.state, 'mine');
  assert.equal(mine.body.token, null);
});

test('claim: taken by another member (never who), empty, two-step sign-in, and a race', async () => {
  account({
    username: 'arkav.panitia',
    claimedBy: bima.id,
    claimedAt: new Date('2026-12-01T02:12:00Z'),
  });
  account({ username: 'nadiaputri07' });
  const tfa = account({ username: 'humas.ext', twoFactor: true });
  link({ name: 'pressrelease-oktober', accountId: tfa.id });
  const look = async (login: string) =>
    (
      await as(nadia, 'POST', '/short-links/claim/lookup', {
        login,
        password: 'rahasia',
      })
    ).body;
  const taken = await look('arkav.panitia');
  assert.equal(taken.state, 'taken');
  assert.equal(taken.claimedAt, '2026-12-01T02:12:00.000Z');
  assert.equal(JSON.stringify(taken).includes(bima.id), false);
  assert.equal((await look('nadiaputri07')).state, 'empty');
  const twoStep = await look('humas.ext');
  assert.equal(twoStep.state, 'two_factor');
  assert.deepEqual(twoStep.links, []);
  assert.equal(twoStep.token, null);

  const raced = account({ username: 'wisnu.dev' });
  link({ name: 'wisnu-porto', accountId: raced.id });
  const { token } = await look('wisnu.dev');
  claimRace = true;
  assert.equal(
    (await as(nadia, 'POST', '/short-links/claim', { token })).status,
    409,
  );
});

test('claim: one bcrypt comparison every time, account or not, at the old accounts’ own cost', async () => {
  account({ username: 'ardiwk' });
  await as(nadia, 'POST', '/short-links/claim/lookup', {
    login: 'tidak.ada',
    password: 'rahasia',
  });
  await as(nadia, 'POST', '/short-links/claim/lookup', {
    login: 'ardiwk',
    password: 'salah',
  });
  assert.equal(compares.length, 2);
  // No imported hash yet: Lynx's own cost, 15.
  assert.match(compares[0].hash, /^\$2[ab]\$15\$.{53}$/);
  assert.equal(compares[1].hash, 'hash:rahasia');
  // Imported hashes decide it: the most common cost among them.
  for (const [i, cost] of ['12', '12', '13'].entries())
    account({
      username: `lama${i}`,
      passwordHash: `$2a$${cost}$${'a'.repeat(53)}`,
    });
  await as(bima, 'POST', '/short-links/claim/lookup', {
    login: 'tidak.ada',
    password: 'x',
  });
  assert.match(compares[2].hash, /^\$2[ab]\$12\$/);
  // A wrong username and a wrong password answer the same (each member's first try).
  const dewi = testUser('u-dewi', {
    nim: '13525903',
    fullName: 'Dewi Lestari',
  });
  const r1 = await as(dewi, 'POST', '/short-links/claim/lookup', {
    login: 'tidak.ada',
    password: 'x',
  });
  const r2 = await as(raka, 'POST', '/short-links/claim/lookup', {
    login: 'ardiwk',
    password: 'x',
  });
  assert.deepEqual([r1.status, r1.body], [r2.status, r2.body]);
});

test('claim: with real bcrypt, a wrong username takes as long as a real account’s wrong password', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const timed = createRouter({
    ...fakeDeps(),
    compare: async (password, hash) => await bcrypt.compare(password, hash),
  });
  // Lynx hashes at 15; 12 keeps the test short and still far from round 1's fixed 10.
  account({
    username: 'ardiwk',
    passwordHash: await bcrypt.hash('rahasia', 12),
  });
  const timeLookUp = async (user: TestUser, login: string) => {
    const t = performance.now();
    const res = await lookUp(user, login, 'salah', timed);
    assert.equal(res.status, 401);
    return performance.now() - t;
  };
  const unknown: number[] = [];
  const real: number[] = [];
  for (let i = 0; i < 2; i++) {
    unknown.push(await timeLookUp(nadia, 'tidak.ada'));
    real.push(await timeLookUp(bima, 'ardiwk'));
  }
  const ratio = Math.min(...real) / Math.min(...unknown);
  assert.ok(
    ratio > 0.6 && ratio < 1.6,
    `a real account took ${ratio.toFixed(2)}× as long as an unknown login`,
  );
});

const PENDING = Symbol('pending');
/** The answer, or PENDING when it hasn't come within `ms` (it should have: nothing it needs is slow). */
const within = async <T>(p: Promise<T>, ms = 300) =>
  await Promise.race([
    p,
    new Promise<typeof PENDING>((r) => setTimeout(() => r(PENDING), ms)),
  ]);
const until = async (done: () => boolean) => {
  for (let i = 0; i < 200 && !done(); i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.ok(done());
};
/** Holds every comparison until the returned function is called, so lookups sent now overlap. */
const holdCompares = () => {
  let open!: () => void;
  compareGate = new Promise<void>((r) => (open = r));
  return () => {
    compareGate = null;
    open();
  };
};
const lookUp = async (
  user: TestUser,
  login = 'ardiwk',
  password = 'salah',
  r = router,
) =>
  await callRouter(r, user, 'POST', '/short-links/claim/lookup', {
    login,
    password,
  });

test('claim: a member has one lookup at a time; a second answers 429 at once, without comparing', async () => {
  account({ username: 'ardiwk' });
  const release = holdCompares();
  const first = lookUp(nadia);
  await until(() => compares.length === 1);
  const second = await within(lookUp(nadia, 'tidak.ada'));
  release();
  if (second === PENDING) assert.fail('the second lookup waited for the first');
  assert.equal(second.status, 429);
  assert.equal(second.body.until, undefined);
  assert.equal(compares.length, 1);
  assert.equal((await first).status, 401);
  // Once the first has answered, the member can look up again.
  assert.equal((await lookUp(nadia)).status, 401);
});

test('claim: the API compares at most two passwords at once; a third member gets 429 at once', async () => {
  account({ username: 'ardiwk' });
  const release = holdCompares();
  const running = [lookUp(nadia), lookUp(bima)];
  await until(() => compares.length === 2);
  const third = await within(lookUp(raka, 'tidak.ada'));
  release();
  if (third === PENDING)
    assert.fail('the third lookup queued instead of answering');
  assert.equal(third.status, 429);
  assert.equal(third.body.until, undefined);
  assert.equal(compares.length, 2);
  assert.deepEqual(
    (await Promise.all(running)).map((r) => r.status),
    [401, 401],
  );
  // With the comparisons done, the third member is let in.
  assert.equal((await lookUp(raka)).status, 401);
});

test('claim: a try counts before its comparison, so tries sent at once never pass five on one account', async () => {
  const a = account({ username: 'ardiwk' });
  const wide = createRouter(fakeDeps(), { maxClaimCompares: 20 });
  const members = Array.from({ length: 8 }, (_, i) =>
    testUser(`u-m${i}`, { nim: `1352599${i}`, fullName: `Anggota ${i}` }),
  );
  const release = holdCompares();
  const all = members.map(
    async (m) => await lookUp(m, 'ardiwk', 'salah', wide),
  );
  await until(() => compares.length >= 5);
  await new Promise((r) => setTimeout(r, 50));
  release();
  const statuses = (await Promise.all(all)).map((r) => r.status).sort();
  assert.equal(compares.length, 5);
  // Four wrong passwords, the fifth locking it, and three refused before comparing.
  assert.deepEqual(statuses, [401, 401, 401, 401, 429, 429, 429, 429]);
  assert.ok(locks.get(`account:${a.id}`)?.lockedUntil);
});

test('claim: a right password gives back only its own try; earlier wrong ones still count', async () => {
  const a = account({ username: 'ardiwk' });
  link({ name: 'arkav-sponsor-deck', accountId: a.id });
  account({ username: 'lain' });
  account({ username: 'ketiga' });
  for (let i = 0; i < 4; i++)
    assert.equal((await lookUp(nadia, 'lain')).status, 401);
  assert.equal((await lookUp(nadia, 'ardiwk', 'rahasia')).body.state, 'found');
  // A member with an old account of their own can't use it to wipe their count and keep guessing other accounts.
  const next = await lookUp(nadia, 'ketiga');
  assert.equal(next.status, 429);
  assert.ok(next.body.until);
});

test('claim: five wrong passwords lock 15 minutes, per member and per old account', async () => {
  const a = account({ username: 'ardiwk' });
  link({ name: 'arkav-sponsor-deck', accountId: a.id });
  const wrong = async (user: TestUser, login = 'ardiwk', password = 'salah') =>
    await as(user, 'POST', '/short-links/claim/lookup', { login, password });
  const left: number[] = [];
  for (let i = 0; i < 4; i++) left.push((await wrong(nadia)).body.triesLeft);
  assert.deepEqual(left, [4, 3, 2, 1]);
  const fifth = await wrong(nadia);
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.until, '2026-12-02T03:15:00.000Z');
  // Locked: even the right password waits, for this member and for this account.
  assert.equal((await wrong(nadia, 'ardiwk', 'rahasia')).status, 429);
  assert.equal((await wrong(bima, 'ardiwk', 'rahasia')).status, 429);
  // Another account isn't locked for another member.
  account({ username: 'nadiaputri07' });
  assert.equal(
    (await wrong(bima, 'nadiaputri07', 'rahasia')).body.state,
    'empty',
  );
  // After 15 minutes the right password works, and the counts start again.
  now = new Date(T0.getTime() + 15 * 60 * 1000 + 1);
  const ok = await wrong(nadia, 'ardiwk', 'rahasia');
  assert.equal(ok.body.state, 'found');
  assert.equal(locks.size, 0);
});

test('claim: after the window it is closed, step 1 and step 2 alike', async () => {
  const a = account({ username: 'ardiwk' });
  link({ name: 'arkav-sponsor-deck', accountId: a.id });
  const { token } = (
    await as(nadia, 'POST', '/short-links/claim/lookup', {
      login: 'ardiwk',
      password: 'rahasia',
    })
  ).body;
  now = new Date('2027-03-01T17:00:00Z');
  assert.equal(
    (
      await as(nadia, 'POST', '/short-links/claim/lookup', {
        login: 'ardiwk',
        password: 'rahasia',
      })
    ).status,
    410,
  );
  assert.equal(
    (await as(nadia, 'POST', '/short-links/claim', { token })).status,
    410,
  );
  assert.equal((await as(nadia, 'GET', '/short-links')).body.claim.open, false);
  assert.equal(compares.length, 1);
});

test('admin’s list is for admin only', async () => {
  assert.equal((await as(nadia, 'GET', '/short-links/all')).status, 401);
  assert.equal(
    (await as(raka, 'GET', '/short-links/all?view=unclaimed')).status,
    200,
  );
});
