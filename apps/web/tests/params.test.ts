// F2-004: the URL's search params and the member kept on the device are checked by plain functions (src/lib/params.ts)
// instead of zod, which loaded before every page's first render. Each check is held here to the zod schema it
// replaced, on the same inputs: the same output (keys kept, dropped or left undefined) and the same throws.
import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import * as mine from '../src/lib/search-params';
import { coerceNumber, object, string } from '../src/lib/params';
import { userSchema } from '../src/lib/member-schema';

const dayParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00+07:00`)));
const kalender = z.object({
  hari: dayParam.optional().catch(undefined),
  acara: z.string().min(1).optional().catch(undefined),
});
const query = z.object({
  q: z
    .union([z.string(), z.number().transform(String)])
    .optional()
    .catch(undefined),
});
/** The zod schemas as they were in src/lib/search-params.ts before F2-004. */
const ZOD: Record<string, z.ZodTypeAny> = {
  kalenderSearchSchema: kalender,
  berandaSearchSchema: kalender,
  appSearchSchema: z.object({
    showAnnounce: z.boolean().optional().catch(undefined),
  }),
  kalenderRouteSearchSchema: kalender.extend({
    tambah: z.literal('acara').optional().catch(undefined),
    selectedDate: z.number().optional().catch(undefined),
    selectedMonth: z.number().optional().catch(undefined),
    selectedYear: z.number().optional().catch(undefined),
  }),
  pengumumanSearchSchema: z.object({
    search: z.string().optional().catch(undefined),
    unread: z.boolean().optional().catch(undefined),
    excludeCategories: z.array(z.string()).optional().catch(undefined),
    sort: z.string().optional().catch(undefined),
  }),
  querySearchSchema: query,
  testiSearchSchema: z.object({
    page: z.number().optional().catch(undefined),
  }),
  matkulTambahSearchSchema: z.object({
    dari: z.literal('mulai').optional().catch(undefined),
  }),
  rekapSearchSchema: z.object({
    q: z.string().optional().catch(undefined),
    halaman: z.number().int().min(1).optional().catch(undefined),
  }),
  spartaDataSearchSchema: z.object({
    q: z.string().optional().catch(undefined),
    divisi: z.string().min(1).optional().catch(undefined),
    pilihan: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .catch(undefined),
    status: z.enum(['terkunci', 'draf']).optional().catch(undefined),
  }),
  inboxSearchSchema: query.extend({
    unread: z.boolean().optional().catch(undefined),
  }),
};

/** Values a URL (or a hand-edited one) can put in a search param, and some it can't. */
const VALUES: unknown[] = [
  undefined,
  null,
  '',
  'x',
  'acara',
  'mulai',
  'terkunci',
  'draf',
  '2026-10-08',
  '2026-13-45',
  '8 Oktober',
  ' 2026-10-08',
  0,
  1,
  2,
  4,
  5,
  -1,
  1.5,
  13524087,
  NaN,
  Infinity,
  true,
  false,
  [],
  ['akademik'],
  ['a', 1],
  {},
  { a: 1 },
];

/** zod's answer, or the fact that it threw. */
const run = (parse: () => unknown) => {
  try {
    return { ok: parse() };
  } catch {
    return { threw: true };
  }
};

/** Same keys, same values; NaN equal to NaN, as deepEqual does. */
const same = (a: unknown, b: unknown, what: string) =>
  assert.deepStrictEqual(a, b, what);

test('every search schema answers exactly as the zod schema it replaced, key by key and all together', () => {
  for (const [name, zod] of Object.entries(ZOD)) {
    const schema = (mine as Record<string, unknown>)[name] as {
      shape: Record<string, unknown>;
      parse: (v: unknown) => unknown;
    };
    assert.ok(schema, `${name} is still exported`);
    const keys = Object.keys(schema.shape);
    assert.deepEqual(
      keys.sort(),
      Object.keys((zod as z.AnyZodObject).shape).sort(),
      `${name}: the same keys`,
    );
    // Each key alone with every value, then every value in every key at once, then nothing, then extra keys.
    for (const key of keys)
      for (const value of VALUES) {
        const input = { [key]: value, other: 'dropped' };
        same(
          run(() => schema.parse(input)),
          run(() => zod.parse(input)),
          `${name}.${key} = ${String(value)}`,
        );
      }
    for (const value of VALUES) {
      const input = Object.fromEntries(keys.map((k) => [k, value]));
      same(
        run(() => schema.parse(input)),
        run(() => zod.parse(input)),
        `${name}: every key ${String(value)}`,
      );
    }
    same(
      run(() => schema.parse({})),
      run(() => zod.parse({})),
      `${name} {}`,
    );
    for (const input of [null, 'x', 1, []])
      same(
        run(() => schema.parse(input)),
        run(() => zod.parse(input)),
        `${name} on ${JSON.stringify(input)}`,
      );
  }
});

test('sign-in’s redirect and the shell probe’s params answer as their zod schemas did', () => {
  const login = object({ redirect: string });
  const zLogin = z.object({ redirect: z.string().optional().catch(undefined) });
  const probe = object({ judul: string, lambat: coerceNumber });
  const zProbe = z.object({
    judul: z.string().optional().catch(undefined),
    lambat: z.coerce.number().optional().catch(undefined),
  });
  for (const value of VALUES) {
    same(
      run(() => login.parse({ redirect: value })),
      run(() => zLogin.parse({ redirect: value })),
      `redirect ${String(value)}`,
    );
    for (const key of ['judul', 'lambat'])
      same(
        run(() => probe.parse({ [key]: value })),
        run(() => zProbe.parse({ [key]: value })),
        `${key} ${String(value)}`,
      );
  }
});

test('the member kept on the device is read back as the zod schema read it', () => {
  const zUser = z
    .object({
      id: z.string(),
      nim: z.string(),
      email: z.string(),
      fullName: z.string(),
      major: z.union([z.literal('IF'), z.literal('STI')]),
      region: z.union([z.literal('Ganesha'), z.literal('Jatinangor')]),
      angkatan: z.number(),
      gender: z.union([z.literal('F'), z.literal('M')]),
      membershipStatus: z.string(),
      picture: z.string(),
      roles: z.array(z.string()),
    })
    .nullable();
  const nadia = {
    id: 'u1',
    nim: '13525045',
    email: '13525045@std.stei.itb.ac.id',
    fullName: 'Nadia Putri',
    major: 'IF',
    region: 'Ganesha',
    angkatan: 2025,
    gender: 'F',
    membershipStatus: 'Anggota Biasa',
    picture: 'https://example.com/a.png',
    roles: [],
    createdAt: 'kept by today’s app, dropped here',
  };
  const cases: unknown[] = [
    nadia,
    null,
    undefined,
    'x',
    {},
    { ...nadia, roles: ['admin', 'akademik'] },
    { ...nadia, major: 'OTHER' },
    { ...nadia, angkatan: '2025' },
    { ...nadia, angkatan: NaN },
    { ...nadia, picture: undefined },
    { ...nadia, roles: [1] },
  ];
  for (const c of cases)
    same(
      run(() => userSchema.parse(c)),
      run(() => zUser.parse(c)),
      JSON.stringify(c),
    );
});
