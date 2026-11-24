// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// Tautan pendek in the database (migration 0037, docs/adr/0024-*): the names (exact and without capitals, kept on a
// rename, reserved when deleted, race-safe), forms sharing them through triggers, the redirect's lookup and clicks,
// matching and claiming old accounts, the lists, and the Lynx import on a made-up export.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;

function throwawayUrl(): string {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required: a throwaway local database named pips_test*',
    );
  }
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (
    !name.startsWith('pips_test') ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error(
      'TEST_DATABASE_URL must be a local database named pips_test*',
    );
  }
  return url;
}

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;
let schema: typeof import('../../src/db/schema');
let repo: typeof import('../../src/repositories/short-link.repo');
let formRepo: typeof import('../../src/repositories/form.repo');
let lib: typeof import('../../src/lib/short-link');
let importer: typeof import('../../scripts/short-links-import');
let eq: typeof import('drizzle-orm').eq;
let postgresError: typeof import('../../src/lib/database-error').postgresError;

const USERS = [
  ['sl-nadia', '13525961', 'Nadia Contoh'],
  ['sl-bima', '13525962', 'Bima Contoh'],
  ['sl-tasya', '13525963', 'Tasya Contoh'],
  ['sl-raka', '13524961', 'Raka Contoh'],
] as const;
const NADIA = 'sl-nadia';
const BIMA = 'sl-bima';
const RAKA = 'sl-raka';

/** Everything this file adds, so it can run again on the same database. */
async function clean() {
  await client`delete from short_links where owner_id like 'sl-%' or lynx_id like 'lnk-%' or id like 'sl-%'
    or id in (select link_id from short_link_names where lower(name) like 'sl-%' or name like 'sl %')
    or form_id like 'sl-%'`;
  await client`delete from short_link_accounts where lynx_id like 'acc-%' or lynx_id like 'sl-%'`;
  await client`delete from short_link_claim_locks where key like '%sl-%'`;
  await client`delete from forms where id like 'sl-%'`;
  await client`delete from users where id like 'sl-%'`;
}

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  schema = await import('../../src/db/schema');
  repo = await import('../../src/repositories/short-link.repo');
  formRepo = await import('../../src/repositories/form.repo');
  lib = await import('../../src/lib/short-link');
  importer = await import('../../scripts/short-links-import');
  ({ eq } = await import('drizzle-orm'));
  ({ postgresError } = await import('../../src/lib/database-error'));
  client = postgres(testUrl, { max: 6, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await clean();
  await db
    .insert(schema.angkatan)
    .values({ year: 2025, name: '2025' })
    .onConflictDoNothing();
  await db.insert(schema.users).values(
    USERS.map(([id, nim, fullName]) => ({
      id,
      nim,
      email: `${nim}@std.stei.itb.ac.id`,
      fullName,
      major: 'IF' as const,
      region: 'Ganesha' as const,
      angkatan: 2025,
      gender: 'F' as const,
      membershipStatus: 'Anggota Biasa',
    })),
  );
});

after(async () => {
  await clean();
  await client?.end();
});

const make = async (
  name: string,
  ownerId: string | null = NADIA,
  destination = `https://example.com/${name}`,
) =>
  ownerId
    ? await repo.createLink(db, { destination, ownerId, name })
    : (
        await db
          .insert(schema.shortLinks)
          .values({ destination })
          .returning({ id: schema.shortLinks.id })
          .then(async ([l]) => {
            await client`select short_link_set_name(${l.id}, ${name}, false)`;
            return [l];
          })
      )[0].id;

const namesOf = async (linkId: string) =>
  await client<Array<{ name: string; is_current: boolean }>>`
    select name, is_current from short_link_names where link_id = ${linkId} order by created_at, name`;

const redirect = async (target: string) => {
  const candidates = lib.nameCandidates(target);
  return lib.pickRedirect(
    await repo.findRedirectRows(db, candidates),
    candidates,
  );
};

test('a name is unique without regard to capitals, even when two members race for it', async () => {
  await make('sl-Makrab');
  await assert.rejects(make('sl-makrab', BIMA), repo.NameTakenError);
  await assert.rejects(make('SL-MAKRAB', BIMA), repo.NameTakenError);
  await assert.rejects(make('sl-Makrab', BIMA), repo.NameTakenError);
  const results = await Promise.allSettled(
    [
      'sl-Rebut',
      'sl-rebut',
      'SL-REBUT',
      'sl-reBut',
      'Sl-rebut',
      'sl-REbut',
    ].map(async (n, i) => await make(n, i % 2 ? NADIA : BIMA)),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  for (const r of results)
    if (r.status === 'rejected')
      assert.ok(r.reason instanceof repo.NameTakenError);
});

test('renaming keeps the old name opening the link; going back to it in other capitals is allowed', async () => {
  const id = await make('sl-slide-pti');
  await repo.renameLink(db, id, 'sl-slide-pti-k4');
  await repo.renameLink(db, id, 'sl-slide-pti-kelas-4');
  assert.deepEqual(
    (await namesOf(id)).map((n) => [n.name, n.is_current]),
    [
      ['sl-slide-pti', false],
      ['sl-slide-pti-k4', false],
      ['sl-slide-pti-kelas-4', true],
    ],
  );
  assert.equal((await redirect('sl-slide-pti'))?.linkId, id);
  assert.equal((await redirect('SL-SLIDE-PTI-K4'))?.linkId, id);
  const view = await repo.getLink(db, id);
  assert.equal(view?.name, 'sl-slide-pti-kelas-4');
  assert.deepEqual(view?.olderNames.sort(), [
    'sl-slide-pti',
    'sl-slide-pti-k4',
  ]);
  // Its own older names are free to it, and to nobody else.
  assert.equal(await repo.nameHolder(db, 'sl-slide-pti', { linkId: id }), null);
  assert.deepEqual(await repo.nameHolder(db, 'SL-Slide-PTI'), {
    held: 'taken',
    heldAs: 'sl-slide-pti',
    heldBy: 'link',
  });
  await repo.renameLink(db, id, 'SL-Slide-PTI');
  assert.equal((await repo.getLink(db, id))?.name, 'SL-Slide-PTI');
  assert.equal((await namesOf(id)).length, 3);
  await assert.rejects(
    repo.renameLink(db, id, 'sl-makrab'),
    repo.NameTakenError,
  );
});

test('a deleted link stops opening and its names are never given out again', async () => {
  const id = await make('sl-oprec-asisten-pti');
  await repo.renameLink(db, id, 'sl-oprec-asisten');
  await repo.deleteLink(db, id);
  assert.equal((await redirect('sl-oprec-asisten'))?.deleted, true);
  const answer = lib.redirectAnswer(
    'sl-oprec-asisten',
    await redirect('sl-oprec-asisten'),
    'https://app.hmif.dev',
  );
  assert.equal(answer.kind, 'not_found');
  for (const n of ['sl-oprec-asisten', 'SL-OPREC-ASISTEN-PTI'])
    assert.deepEqual(await repo.nameHolder(db, n), {
      held: 'used',
      heldAs: n.toLowerCase(),
      heldBy: 'link',
    });
  await assert.rejects(make('sl-oprec-asisten-pti', BIMA), repo.NameTakenError);
  // The deleted link's last holder still sees what happened.
  const row = await repo.getLink(db, id);
  assert.ok(row?.deletedAt);
  assert.equal(row?.ownerId, NADIA);
});

test('old twins keep opening by their exact names; capitals alone choose neither; a new name can’t join them', async () => {
  const a = await make('sl-Twin', null);
  const b = (
    await db
      .insert(schema.shortLinks)
      .values({ destination: 'https://example.com/b' })
      .returning()
  )[0].id;
  await client`insert into short_link_names (name, link_id, holds_fold) values ('sl-twin', ${b}, false)`;
  assert.equal((await redirect('sl-Twin'))?.linkId, a);
  assert.equal((await redirect('sl-twin'))?.linkId, b);
  assert.equal(await redirect('SL-TWIN'), null);
  await assert.rejects(make('SL-TWIN', BIMA), repo.NameTakenError);
  await assert.rejects(repo.renameLink(db, b, 'SL-Twin'), repo.NameTakenError);
});

test('the redirect finds raw, decoded and query names in one lookup, and clicks add up together', async () => {
  const space = await make('sl-dummy-space', null, 'https://example.com/space');
  await client`update short_link_names set name = 'sl Daftar Bukber' where link_id = ${space}`;
  const query = await make('sl-dummy-query', null, 'https://example.com/query');
  await client`update short_link_names set name = 'sl-apa?ini' where link_id = ${query}`;
  assert.equal((await redirect('sl%20Daftar%20Bukber'))?.linkId, space);
  assert.equal((await redirect('sl-apa?ini'))?.linkId, query);
  assert.equal((await redirect('SL-APA?INI'))?.linkId, query);
  await repo.addClicks(
    db,
    new Map([
      [space, 3],
      [query, 1],
    ]),
  );
  await repo.addClicks(db, new Map([[space, 2]]));
  const [s] = await client`select clicks from short_links where id = ${space}`;
  assert.equal(s.clicks, 5);
});

test('forms share the names: a draft’s name follows it, a published form keeps its old names, a deleted one reserves them', async () => {
  const sections = [{ id: 's1', title: '', questions: [] }];
  await db.insert(schema.forms).values({
    id: 'sl-form-draft',
    slug: 'sl-draf-form',
    title: 'Draf',
    sections,
    ownerId: NADIA,
    publishedAt: null,
    isActive: false,
  });
  const linkId = await repo.formLinkId(db, 'sl-form-draft');
  assert.ok(linkId);
  assert.deepEqual(await repo.nameHolder(db, 'SL-DRAF-FORM'), {
    held: 'taken',
    heldAs: 'sl-draf-form',
    heldBy: 'form',
  });
  await assert.rejects(make('sl-draf-form', BIMA), repo.NameTakenError);
  // A draft's name follows its title; the old one is let go.
  await db
    .update(schema.forms)
    .set({ slug: 'sl-makrab-2026' })
    .where(eq(schema.forms.id, 'sl-form-draft'));
  assert.deepEqual(
    (await namesOf(linkId!)).map((n) => n.name),
    ['sl-makrab-2026'],
  );
  assert.equal(await repo.nameHolder(db, 'sl-draf-form'), null);
  // Not listed while a draft.
  assert.equal(
    (
      await repo.listMemberLinks(db, NADIA, {
        order: 'new',
        limit: 50,
        offset: 0,
      })
    ).rows.some((r) => r.formId),
    false,
  );
  // Published, then renamed: the old name still opens it, here and at /f/.
  await db
    .update(schema.forms)
    .set({ publishedAt: new Date(), isActive: true })
    .where(eq(schema.forms.id, 'sl-form-draft'));
  await db
    .update(schema.forms)
    .set({ slug: 'SL-Makrab-Seru' })
    .where(eq(schema.forms.id, 'sl-form-draft'));
  assert.equal(
    (await formRepo.getFormBySlug(db, 'sl-makrab-2026'))?.id,
    'sl-form-draft',
  );
  assert.equal(
    (await formRepo.getFormBySlug(db, 'sl-makrab-seru'))?.id,
    'sl-form-draft',
  );
  const via = await redirect('sl-makrab-2026');
  assert.deepEqual(
    lib.redirectAnswer('sl-makrab-2026', via, 'https://app.hmif.dev'),
    {
      kind: 'link',
      location: 'https://app.hmif.dev/f/SL-Makrab-Seru',
      linkId,
    },
  );
  assert.equal(
    await formRepo.slugTaken(db, 'sl-makrab-2026', 'sl-form-draft'),
    false,
  );
  assert.equal(await formRepo.slugTaken(db, 'sl-makrab-2026', null), true);
  // The form taking a name a short link holds fails like a clash between forms.
  await make('sl-punya-tautan');
  await assert.rejects(
    db
      .update(schema.forms)
      .set({ slug: 'sl-punya-tautan' })
      .where(eq(schema.forms.id, 'sl-form-draft')),
    (err) => postgresError(err)?.code === '23505',
  );
  const listed = await repo.listMemberLinks(db, NADIA, {
    order: 'new',
    limit: 50,
    offset: 0,
  });
  assert.ok(
    listed.rows.some(
      (r) => r.formId === 'sl-form-draft' && r.name === 'SL-Makrab-Seru',
    ),
  );
  // Deleted: its names stay reserved.
  await db.delete(schema.forms).where(eq(schema.forms.id, 'sl-form-draft'));
  assert.equal((await repo.nameHolder(db, 'sl-makrab-2026'))?.held, 'used');
  assert.equal(await formRepo.getFormBySlug(db, 'sl-makrab-seru'), undefined);
  // A deleted draft lets its name go.
  await db.insert(schema.forms).values({
    id: 'sl-form-gone',
    slug: 'sl-draf-hilang',
    title: 'x',
    sections,
    publishedAt: null,
  });
  await db.delete(schema.forms).where(eq(schema.forms.id, 'sl-form-gone'));
  assert.equal(await repo.nameHolder(db, 'sl-draf-hilang'), null);
});

test('a member’s list: search, the two orders, pages; admin’s: owners, unclaimed and their accounts', async () => {
  const [acct] = await db
    .insert(schema.shortLinkAccounts)
    .values({ lynxId: 'sl-acct-semnas', username: 'sl.panitia.semnas' })
    .returning();
  for (const [name, clicks] of [
    ['sl-list-a', 5],
    ['sl-list-b', 50],
    ['sl-list-c', 0],
  ] as const) {
    const id = await make(name, RAKA, `https://docs.example.com/${name}`);
    await client`update short_links set clicks = ${clicks} where id = ${id}`;
  }
  for (const name of ['sl-semnas-1', 'sl-semnas-2']) {
    const id = await make(name, null);
    await client`update short_links set account_id = ${acct.id} where id = ${id}`;
  }
  const q = { order: 'new' as const, limit: 2, offset: 0 };
  const first = await repo.listMemberLinks(db, RAKA, q);
  assert.equal(first.total, 3);
  assert.deepEqual(
    first.rows.map((r) => r.name),
    ['sl-list-c', 'sl-list-b'],
  );
  assert.deepEqual(
    (await repo.listMemberLinks(db, RAKA, { ...q, offset: 2 })).rows.map(
      (r) => r.name,
    ),
    ['sl-list-a'],
  );
  assert.deepEqual(
    (
      await repo.listMemberLinks(db, RAKA, { ...q, order: 'clicks', limit: 3 })
    ).rows.map((r) => r.name),
    ['sl-list-b', 'sl-list-a', 'sl-list-c'],
  );
  assert.deepEqual(
    (await repo.listMemberLinks(db, RAKA, { ...q, search: 'LIST-B' })).rows.map(
      (r) => r.name,
    ),
    ['sl-list-b'],
  );
  assert.equal(
    (await repo.listMemberLinks(db, RAKA, { ...q, search: '%' })).total,
    0,
  );
  const byOwner = await repo.listAllLinks(db, {
    order: 'new',
    limit: 50,
    offset: 0,
    view: 'all',
    search: '13524961',
  });
  assert.ok(byOwner.rows.length >= 3);
  assert.ok(byOwner.rows.every((r) => r.ownerNim === '13524961'));
  const unclaimed = await repo.listAllLinks(db, {
    order: 'new',
    limit: 50,
    offset: 0,
    view: 'unclaimed',
    search: 'sl.panitia',
  });
  assert.deepEqual(unclaimed.rows.map((r) => r.name).sort(), [
    'sl-semnas-1',
    'sl-semnas-2',
  ]);
  assert.equal(unclaimed.accounts, 1);
  assert.equal(unclaimed.rows[0].accountUsername, 'sl.panitia.semnas');
});

test('claiming: one member wins a race, every unheld link moves, and matching goes by email then NIM', async () => {
  const [a] = await db
    .insert(schema.shortLinkAccounts)
    .values({ lynxId: 'sl-acct-race', username: 'sl.race' })
    .returning();
  const ids = [
    await make('sl-race-1', null),
    await make('sl-race-2', null),
    await make('sl-race-3', BIMA),
  ];
  for (const id of ids)
    await client`update short_links set account_id = ${a.id} where id = ${id}`;
  const results = await Promise.all(
    [NADIA, BIMA, 'sl-tasya'].map(
      async (userId) =>
        await repo.claimAccount(db, {
          accountId: a.id,
          userId,
          via: 'password',
        }),
    ),
  );
  assert.equal(results.filter((r) => r !== null).length, 1);
  assert.equal(
    results.find((r) => r !== null),
    2,
  );
  const [claimed] =
    await client`select claimed_by from short_link_accounts where id = ${a.id}`;
  const [kept] =
    await client`select owner_id from short_links where id = ${ids[2]}`;
  assert.equal(kept.owner_id, BIMA);
  assert.equal((await repo.unclaimedAccountLinks(db, a.id)).length, 0);
  assert.ok(claimed.claimed_by);

  const [byEmail] = await db
    .insert(schema.shortLinkAccounts)
    .values({
      lynxId: 'sl-acct-email',
      username: 'sl.tasya',
      email: '13525963@STD.stei.itb.ac.id',
    })
    .returning();
  const [byNim] = await db
    .insert(schema.shortLinkAccounts)
    .values({
      lynxId: 'sl-acct-nim',
      username: 'sl.tasya.lama',
      nim: '13525963',
    })
    .returning();
  const e = await make('sl-match-email', null);
  const n2 = await make('sl-match-nim', null);
  await client`update short_links set account_id = ${byEmail.id} where id = ${e}`;
  await client`update short_links set account_id = ${byNim.id} where id = ${n2}`;
  const moved = await repo.matchMemberAccounts(db, {
    id: 'sl-tasya',
    email: '13525963@std.stei.itb.ac.id',
    nim: '13525963',
  });
  assert.equal(moved, 2);
  const vias = await client<Array<{ claimed_via: string }>>`
    select claimed_via from short_link_accounts where id in (${byEmail.id}, ${byNim.id}) order by lynx_id`;
  assert.deepEqual(
    vias.map((v) => v.claimed_via),
    ['email', 'nim'],
  );
  // Again: nothing more (never undoes or repeats a claim).
  assert.equal(
    await repo.matchMemberAccounts(db, {
      id: NADIA,
      email: '13525963@std.stei.itb.ac.id',
      nim: '13525963',
    }),
    0,
  );
});

test('claim tries count before the comparison under row locks: of eight at once, exactly five pass', async () => {
  const at = new Date('2026-12-02T03:00:00Z');
  const keys = ['user:sl-nadia', 'account:sl-x'];
  const results = await Promise.all(
    Array.from(
      { length: 8 },
      async (_, i) =>
        await repo.reserveClaimTry(db, i % 2 ? keys : [keys[1]], at),
    ),
  );
  assert.equal(results.filter((r) => 'locks' in r).length, 5);
  for (const r of results)
    if ('locked' in r)
      assert.equal(r.locked.toISOString(), '2026-12-02T03:15:00.000Z');
  const [account] = await repo.getClaimLocks(db, ['account:sl-x']);
  assert.equal(account.tries, 5);
  assert.equal(account.lockedUntil?.toISOString(), '2026-12-02T03:15:00.000Z');
  // A right password gives its try back: four still counted, and no lock.
  await repo.giveBackClaimTry(db, ['account:sl-x']);
  const [back] = await repo.getClaimLocks(db, ['account:sl-x']);
  assert.equal(back.tries, 4);
  assert.equal(back.lockedUntil, null);
  // Given back to nothing, the rows go.
  for (let i = 0; i < 4; i++) await repo.giveBackClaimTry(db, keys);
  assert.equal((await repo.getClaimLocks(db, keys)).length, 0);
});

test('an unknown login is compared at the old accounts’ most common hash cost', async () => {
  const rollback = new Error('rollback');
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.update(schema.shortLinkAccounts).set({ passwordHash: null });
      assert.equal(await repo.commonHashCost(tx), null);
      const hash = (prefix: string, cost: string) =>
        `$${prefix}$${cost}$${'b'.repeat(53)}`;
      await tx.insert(schema.shortLinkAccounts).values(
        [
          hash('2a', '15'),
          hash('2b', '15'),
          hash('2b', '10'),
          hash('2a', '12'),
          hash('2a', '12'),
          'not a bcrypt hash',
        ].map((passwordHash, i) => ({
          lynxId: `sl-cost-${i}`,
          username: `sl.cost${i}`,
          passwordHash,
        })),
      );
      // A tie goes to the higher cost, the slower one.
      assert.equal(await repo.commonHashCost(tx), 15);
      await tx.insert(schema.shortLinkAccounts).values({
        lynxId: 'sl-cost-x',
        username: 'sl.costx',
        passwordHash: hash('2b', '12'),
      });
      assert.equal(await repo.commonHashCost(tx), 12);
      throw rollback;
    }),
    rollback,
  );
});

test('giving a link with its account: the rest move, the account counts as claimed, the last holder is kept', async () => {
  const [a] = await db
    .insert(schema.shortLinkAccounts)
    .values({ lynxId: 'sl-acct-give', username: 'sl.give' })
    .returning();
  const ids = [await make('sl-give-1', null), await make('sl-give-2', null)];
  for (const id of ids)
    await client`update short_links set account_id = ${a.id} where id = ${id}`;
  assert.equal(
    await repo.giveLink(db, {
      linkId: ids[0],
      toUserId: NADIA,
      withAccount: true,
    }),
    2,
  );
  const [acc] =
    await client`select claimed_by, claimed_via from short_link_accounts where id = ${a.id}`;
  assert.deepEqual([acc.claimed_by, acc.claimed_via], [NADIA, 'admin']);
  assert.equal(
    await repo.giveLink(db, {
      linkId: ids[0],
      toUserId: BIMA,
      withAccount: false,
    }),
    1,
  );
  const row = await repo.getLink(db, ids[0]);
  assert.deepEqual([row?.ownerId, row?.previousOwnerId], [BIMA, NADIA]);
});

// The import, on a made-up export shaped like Lynx's (every odd character, a twin pair, a two-step account, both
// hash prefixes, a link with no account).

const fixture = (f: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8');

const runImport = async (dryRun: boolean, links = fixture('lynx-links.json')) =>
  await importer.importShortLinks({
    sql: client,
    links: importer.toLinks(
      importer.readExport(links),
      new Date('2026-12-01T00:00:00Z'),
    ),
    accounts: importer.toAccounts(
      importer.readExport(fixture('lynx-accounts.json')),
    ),
    dryRun,
    claimClosed: false,
  });

test('the import’s dry run counts everything and writes nothing', async () => {
  const r = await runImport(true);
  assert.equal(r.links, 25);
  assert.equal(r.accounts, 6);
  assert.equal(r.linksAdded, 25);
  assert.deepEqual(r.matchedByEmail, { accounts: 1, links: 2 });
  assert.deepEqual(r.matchedByNim, { accounts: 2, links: 3 });
  assert.deepEqual(r.unmatched, { accounts: 3, links: 19 });
  assert.equal(r.twoFactor, 1);
  assert.equal(r.namesBreakingRule, 17);
  assert.equal(r.twinPairs, 1);
  assert.deepEqual(
    r.unreachableNames.map((u) => u.name),
    ['rapat#2'],
  );
  assert.deepEqual(
    r.nonHttpLinks.map((u) => u.name),
    ['surel', 'berkas'],
  );
  assert.deepEqual(r.hashes, { '$2a$ cost 04': 2, '$2b$ cost 04': 4 });
  const printed = importer.formatReport(r, true, false);
  assert.match(printed, /^Dry run: nothing was written\./);
  assert.equal(printed.includes('$2b$04$'), false);
  assert.equal(printed.includes('rapat#2'), false);
  const [{ n }] =
    await client`select count(*)::int as n from short_links where lynx_id like 'lnk-%'`;
  assert.equal(n, 0);
  const [{ m }] =
    await client`select count(*)::int as m from short_link_accounts where lynx_id like 'acc-%'`;
  assert.equal(m, 0);
});

test('the import writes it all, every old name opens as it did, and running it again changes nothing', async () => {
  const r = await runImport(false);
  assert.equal(r.linksAdded, 25);
  assert.equal(r.accountsAdded, 6);
  for (const [target, dest] of [
    ['Makrab', 'lnk-3'],
    ['makrab', 'lnk-4'],
    ['Catatan_PTI', 'lnk-2'],
    ['LowonginAja!', 'lnk-6'],
    ['semnas/daftar', 'lnk-8'],
    ['Daftar%20Bukber', 'lnk-9'],
    ['apa?ini', 'lnk-10'],
    ['%C2%BFque', 'lnk-13'],
    ['bayarkashmif', 'lnk-5'],
  ]) {
    const found = await redirect(target);
    const [row] =
      await client`select lynx_id from short_links where id = ${found?.linkId ?? ''}`;
    assert.equal(row?.lynx_id, dest, target);
  }
  assert.equal(await redirect('MAKRAB'), null);
  assert.equal(
    lib.redirectAnswer('surel', await redirect('surel'), 'https://app.hmif.dev')
      .kind,
    'not_found',
  );
  const owners = await client<Array<{ slug: string; owner_id: string | null }>>`
    select n.name as slug, l.owner_id from short_links l join short_link_names n on n.link_id = l.id
    where l.lynx_id in ('lnk-1', 'lnk-4', 'lnk-9', 'lnk-24', 'lnk-25') order by l.lynx_id`;
  assert.deepEqual(
    Object.fromEntries(owners.map((o) => [o.slug, o.owner_id])),
    {
      'bukber-pixel-25': 'sl-nadia',
      makrab: 'sl-bima',
      'Daftar Bukber': 'sl-tasya',
      'pressrelease-oktober': null,
      'tanpa-pemilik': null,
    },
  );
  const [tfa] =
    await client`select two_factor, password_hash is not null as has_hash from short_link_accounts where lynx_id = 'acc-2fa'`;
  assert.deepEqual([tfa.two_factor, tfa.has_hash], [true, true]);
  const [{ clicks }] =
    await client`select sum(clicks)::int as clicks from short_links where lynx_id like 'lnk-%'`;

  const again = await runImport(false);
  assert.equal(again.linksAdded, 0);
  assert.equal(again.linksUpdated, 0);
  assert.equal(again.clicksAdded, 0);
  assert.equal(again.accountsAdded, 0);
  const [{ clicks: same }] =
    await client`select sum(clicks)::int as clicks from short_links where lynx_id like 'lnk-%'`;
  assert.equal(same, clicks);
});

test('a later import adds what is new, follows changes made only on the old service, and never undoes PIPS!’s', async () => {
  // In PIPS!: a member changes one link, an admin gives another away, a third is deleted, a member claims an account.
  const idOf = async (lynx: string) =>
    (await client`select id from short_links where lynx_id = ${lynx}`)[0]
      .id as string;
  const changed = await idOf('lnk-1');
  await repo.setDestination(db, changed, 'https://example.com/diubah-di-pips');
  const given = await idOf('lnk-5');
  await repo.giveLink(db, {
    linkId: given,
    toUserId: 'sl-raka',
    withAccount: false,
  });
  const deleted = await idOf('lnk-12');
  await repo.deleteLink(db, deleted);
  const [old] =
    await client`select id from short_link_accounts where lynx_id = 'acc-old'`;
  await repo.claimAccount(db, {
    accountId: old.id,
    userId: BIMA,
    via: 'password',
  });

  // On the old service meanwhile: more visits, a changed destination and name, a new link, a deleted one.
  const later = '2026-12-01T05:00:00.000Z';
  const docs = fixture('lynx-links.json')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  const edit = (id: string, o: Record<string, unknown>) =>
    Object.assign(
      docs.find((d) => d.id === id)!,
      o,
    );
  edit('lnk-1', {
    destination: 'https://example.com/diubah-di-lynx',
    modifiedDate: { $date: later },
    visits: 200,
  });
  edit('lnk-2', {
    destination: 'https://example.com/catatan-baru',
    slug: 'catatan-pti',
    modifiedDate: { $date: later },
  });
  edit('lnk-12', {
    destination: 'https://example.com/hidup-lagi',
    modifiedDate: { $date: later },
  });
  edit('lnk-3', { visits: 45 });
  docs.push({
    id: 'lnk-26',
    slug: 'sl-baru-di-lynx',
    destination: 'https://example.com/baru',
    author: 'acc-old',
    creationDate: { $date: later },
    modifiedDate: { $date: later },
    visits: 1,
  });
  const without = docs.filter((d) => d.id !== 'lnk-25');
  const r = await runImport(
    false,
    without.map((d) => JSON.stringify(d)).join('\n'),
  );

  assert.equal(r.linksAdded, 1);
  assert.equal(r.linksUpdated, 1);
  assert.equal(r.changedOnBothSides, 1);
  assert.equal(r.clicksAdded, 14 + 5);
  assert.equal(r.inPipsNotInExport, 1);
  const link = async (lynx: string) => await repo.getLink(db, await idOf(lynx));
  assert.equal(
    (await link('lnk-1'))?.destination,
    'https://example.com/diubah-di-pips',
  );
  const renamed = await link('lnk-2');
  assert.equal(renamed?.destination, 'https://example.com/catatan-baru');
  assert.equal(renamed?.name, 'catatan-pti');
  assert.deepEqual(renamed?.olderNames, ['Catatan_PTI']);
  assert.ok((await link('lnk-12'))?.deletedAt);
  assert.equal((await link('lnk-5'))?.ownerId, 'sl-raka');
  // A new link of a claimed account is the claimer's; the claim stands.
  assert.equal((await link('lnk-26'))?.ownerId, BIMA);
  const [acc] =
    await client`select claimed_by, password_hash is not null as has_hash from short_link_accounts where id = ${old.id}`;
  assert.equal(acc.claimed_by, BIMA);
  assert.equal((await link('lnk-25'))?.deletedAt, null);
});

test('forgetting the passwords waits for the window to end', async () => {
  await assert.rejects(
    importer.forgetPasswords(client, undefined, new Date()),
    /still open/,
  );
  await assert.rejects(
    importer.forgetPasswords(
      client,
      new Date('2027-03-01T17:00:00Z'),
      new Date('2027-02-01T00:00:00Z'),
    ),
    /still open/,
  );
  const n = await importer.forgetPasswords(
    client,
    new Date('2027-03-01T17:00:00Z'),
    new Date('2027-03-02T00:00:00Z'),
  );
  assert.ok(n >= 1);
  const [{ left }] =
    await client`select count(*)::int as left from short_link_accounts where password_hash is not null`;
  assert.equal(left, 0);
});
