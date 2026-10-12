import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { ProgrammeWindow } from '../src/db/schema';
import type { ProgrammeWindowDeps } from '../src/controllers/programme-window.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

const NOW = new Date('2026-10-08T06:35:00.000Z');
const nadia = testUser('u-nadia', { nim: '13525045', angkatan: 2025 });
const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });

function row(over: Partial<ProgrammeWindow>): ProgrammeWindow {
  return {
    id: 'w1',
    slug: 'sparta-2027',
    kind: 'programme',
    label: 'Magang SPARTA',
    route: '/layanan/sparta',
    opensAt: new Date('2026-10-01T00:00:00Z'),
    closesAt: null,
    eligibleAngkatan: [],
    eligibleNims: [],
    isActive: true,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...over,
  };
}

let createProgrammeWindowRouter: typeof import('../src/controllers/programme-window.controller').createProgrammeWindowRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createProgrammeWindowRouter } =
    await import('../src/controllers/programme-window.controller'));
});

const router = (rows: ProgrammeWindow[], now = NOW) =>
  createProgrammeWindowRouter({
    getActiveProgrammeWindows: async () => rows,
    now: () => now,
  } satisfies ProgrammeWindowDeps);

test('GET /programme-windows: the windows open now for you, without the eligibility lists', async () => {
  const rows = [
    row({ id: 'open', eligibleAngkatan: [2025] }),
    row({ id: 'later', slug: 'b', opensAt: new Date('2026-10-09T00:00:00Z') }),
    row({ id: 'over', slug: 'c', closesAt: NOW }),
    row({
      id: 'nims',
      slug: 'd',
      kind: 'campaign',
      eligibleNims: [raka.nim],
      route: 'https://hmif.dev/pemilu',
    }),
    row({ id: 'bad-route', slug: 'e', route: '//evil.com' }),
  ];
  const forNadia = await callRouter(
    router(rows),
    nadia,
    'GET',
    '/programme-windows',
  );
  assert.equal(forNadia.status, 200);
  assert.deepEqual(forNadia.body, {
    windows: [
      {
        id: 'open',
        slug: 'sparta-2027',
        kind: 'programme',
        label: 'Magang SPARTA',
        route: '/layanan/sparta',
        opensAt: '2026-10-01T00:00:00.000Z',
        closesAt: null,
      },
    ],
  });
  const forRaka = await callRouter(
    router(rows),
    raka,
    'GET',
    '/programme-windows',
  );
  assert.deepEqual(
    forRaka.body.windows.map((w: { id: string }) => w.id),
    ['nims'],
  );
});

test('exactly at opensAt it shows; exactly at closesAt it is gone', async () => {
  const w = row({ opensAt: NOW, closesAt: new Date(NOW.getTime() + 1000) });
  assert.equal(
    (await callRouter(router([w], NOW), nadia, 'GET', '/programme-windows'))
      .body.windows.length,
    1,
  );
  assert.equal(
    (
      await callRouter(
        router([w], new Date(NOW.getTime() + 1000)),
        nadia,
        'GET',
        '/programme-windows',
      )
    ).body.windows.length,
    0,
  );
});

test('signed out is 401; an empty table answers an empty list', async () => {
  assert.equal(
    (await callRouter(router([]), null, 'GET', '/programme-windows')).status,
    401,
  );
  assert.deepEqual(
    (await callRouter(router([]), nadia, 'GET', '/programme-windows')).body,
    {
      windows: [],
    },
  );
});

test('the route is mounted in the app', async () => {
  const { createApp } = await import('../src/app');
  const res = await createApp().request('/api/programme-windows');
  assert.equal(res.status, 401);
  const doc = (await (await createApp().request('/doc')).json()) as {
    paths: object;
  };
  assert.ok('/api/programme-windows' in doc.paths);
});
