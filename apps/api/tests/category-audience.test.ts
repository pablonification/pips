import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  canPostInCategory,
  checkPostCategories,
} from '../src/lib/category-audience';
import type { InfoDeps } from '../src/controllers/info.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

test('null admits everyone, a list admits its roles, an empty list admits nobody', () => {
  assert.equal(canPostInCategory([], null), true);
  assert.equal(canPostInCategory([], undefined), true);
  assert.equal(canPostInCategory(['akademik'], ['akademik', 'admin']), true);
  assert.equal(canPostInCategory(['ring1'], ['akademik']), false);
  assert.equal(canPostInCategory([], ['akademik']), false);
  assert.equal(canPostInCategory(['akademik', 'admin'], []), false);
});

test('the rule is the one the category list uses (category.repo.ts)', () => {
  const repo = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/repositories/category.repo.ts'),
    'utf8',
  );
  // Listed when rolesAllowed is NULL, or when one of its roles is one of the member's.
  assert.match(repo, /isNull\(categories\.rolesAllowed\)/);
  assert.match(
    repo,
    /json_array_elements_text\(\$\{categories\.rolesAllowed\}\) AS role WHERE role IN/,
  );
});

test('one closed or unknown category refuses the post', () => {
  const cats = [
    { id: 'umum', rolesAllowed: null },
    { id: 'akademik', rolesAllowed: ['akademik'] },
    { id: 'tutup', rolesAllowed: [] },
  ];
  assert.deepEqual(checkPostCategories([], ['umum'], cats), { ok: true });
  assert.deepEqual(checkPostCategories([], ['umum', 'akademik'], cats), {
    ok: false,
    reason: 'forbidden',
    categoryIds: ['akademik'],
  });
  assert.deepEqual(
    checkPostCategories(['akademik'], ['umum', 'akademik'], cats),
    { ok: true },
  );
  assert.deepEqual(
    checkPostCategories(['akademik', 'admin'], ['tutup'], cats),
    {
      ok: false,
      reason: 'forbidden',
      categoryIds: ['tutup'],
    },
  );
  assert.deepEqual(checkPostCategories([], ['nope'], cats), {
    ok: false,
    reason: 'unknown',
    categoryIds: ['nope'],
  });
});

// --- POST /info through the real router, storage faked ---

const nadia = testUser('u-nadia');
const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });
const ROLES: Record<string, string[]> = { [raka.id]: ['akademik', 'ring1'] };
const CATEGORIES = [
  { id: 'cat-umum', rolesAllowed: null },
  { id: 'cat-akademik', rolesAllowed: ['akademik'] },
  { id: 'cat-tutup', rolesAllowed: [] },
];

let createInfoRouter: typeof import('../src/controllers/info.controller').createInfoRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createInfoRouter } = await import('../src/controllers/info.controller'));
});

function router(created: unknown[]) {
  const unused = async () => {
    throw new Error('not used in this test');
  };
  const deps = {
    getUserRoles: async (id: string) => ROLES[id] ?? [],
    getCategoriesByIds: async (ids: string[]) =>
      CATEGORIES.filter((c) => ids.includes(c.id)),
    createInfo: async (data: { creatorId: string }) => {
      const info = { id: `info-${created.length + 1}`, ...data };
      created.push(info);
      return info;
    },
    notifyNewInfo: async () => {},
    createReadInfo: unused,
    deleteReadInfo: unused,
    getInfoCreatorId: unused,
    deleteInfo: unused,
    getListInfos: unused,
    getInfoById: unused,
    renotifyInfo: unused,
  } as unknown as InfoDeps;
  return createInfoRouter(deps);
}

const post = (forCategories: string[]) => ({
  title: 'Kuis 2 dimajukan',
  content: 'Kuis 2 IF2123 dimajukan ke Selasa.',
  forCategories,
});

// Regression (C9): the refusal came from createInfo throwing a plain Error, which the API answered as a 500.
test('posting in a category whose rolesAllowed excludes you is refused with 403, and nothing is created', async () => {
  const created: unknown[] = [];
  const res = await callRouter(
    router(created),
    nadia,
    'POST',
    '/info',
    post(['cat-akademik']),
  );
  assert.equal(res.status, 403);
  assert.deepEqual(created, []);
  const mixed = await callRouter(
    router(created),
    nadia,
    'POST',
    '/info',
    post(['cat-umum', 'cat-akademik']),
  );
  assert.equal(mixed.status, 403);
  assert.deepEqual(created, []);
});

test('a member with the role, and anyone in an open category, may post', async () => {
  const created: unknown[] = [];
  assert.equal(
    (
      await callRouter(
        router(created),
        raka,
        'POST',
        '/info',
        post(['cat-akademik']),
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await callRouter(
        router(created),
        nadia,
        'POST',
        '/info',
        post(['cat-umum']),
      )
    ).status,
    201,
  );
  assert.equal(created.length, 2);
});

test('an empty rolesAllowed refuses everyone; an unknown category is 400', async () => {
  const created: unknown[] = [];
  assert.equal(
    (
      await callRouter(
        router(created),
        raka,
        'POST',
        '/info',
        post(['cat-tutup']),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await callRouter(
        router(created),
        raka,
        'POST',
        '/info',
        post(['cat-hilang']),
      )
    ).status,
    400,
  );
  assert.deepEqual(created, []);
});
