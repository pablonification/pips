// The MCP endpoint, driven by the official MCP client with no network. Its tools call the API's own routes (here
// with fake storage) as the member the token stands for, so the routes' checks decide: a plain anggota is refused
// what only akademik or admin may do, and the tool returns the route's refusal.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { hashSecret, inSeconds } from '../src/lib/oauth';
import { memoryOAuthStore } from './support/oauth-store';
import { testUser } from './support/session';

const anggota = testUser('anggota-1', { nim: '13525901', angkatan: 2025 });
const akademik = testUser('akademik-1', { nim: '13524902', angkatan: 2024 });
const admin = testUser('admin-1', { nim: '13523903', angkatan: 2023 });
const ROLES: Record<string, string[]> = {
  [anggota.id]: [],
  [akademik.id]: ['akademik'],
  [admin.id]: ['admin'],
};

let mcpApp: OpenAPIHono;
let store: ReturnType<typeof memoryOAuthStore>;
/** Every request the tools sent to the API, as the route saw it. */
const seen: Array<{
  method: string;
  path: string;
  cookie: boolean;
  origin: string | null;
}> = [];
const createdEvents: unknown[] = [];
const createdForms: Array<{ ownerId: string; title: string }> = [];
/** Data diri as the database keeps it, by member. */
const savedDetails = new Map<string, Record<string, unknown>>();

/** An access token for `user` with `scope`, stored as the token endpoint would store it. */
async function grant(user: { id: string }, scope = 'pips.read pips.write') {
  const access = `pips_at_${user.id}_${scope.length}_${Math.random()}`;
  store.insertToken(
    {
      family: `family-${access}`,
      clientId: 'client-1',
      userId: user.id,
      scope,
      accessHash: hashSecret(access),
      accessExpiresAt: inSeconds(3600, store.clock.now),
      refreshHash: hashSecret(`r-${access}`),
      refreshExpiresAt: inSeconds(86400, store.clock.now),
    },
    store.clock.now,
  );
  return access;
}

async function connect(accessToken: string) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/mcp'),
    {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
      fetch: async (url, init) =>
        await mcpApp.request(String(url), init as RequestInit),
    },
  );
  await client.connect(transport);
  return client;
}

const textOf = (result: any) =>
  (result.content as Array<{ text: string }>)[0].text;

before(async () => {
  usePlaceholderEnv({ API_PUBLIC_URL: 'https://api.example.test' });
  store = memoryOAuthStore({
    [anggota.id]: anggota,
    [akademik.id]: akademik,
    [admin.id]: admin,
  });
  const getUserRoles = async (id: string) => (ROLES[id] ?? []) as never[];

  const { createCalendarRouter } =
    await import('../src/controllers/calendar.controller');
  const { createFormRouter } =
    await import('../src/controllers/form.controller');
  const { createInfoRouter } =
    await import('../src/controllers/info.controller');
  const { createFormManageRouter } =
    await import('../src/controllers/form-manage.controller');
  const { createMcpRouter } = await import('../src/controllers/mcp.controller');

  const group = {
    id: 'group-1',
    category: 'akademik',
    googleCalendarUrl: 'calendar-akademik',
  };
  const calendar = createCalendarRouter({
    getUserRoles,
    getCalendarGroupByCourseId: async () => group,
    getCalendarGroupByCategory: async () => ({
      ...group,
      category: 'himpunan',
    }),
    createCalendarEvent: async (row: any) => {
      const created = { id: 'event-1', ...row };
      createdEvents.push(created);
      return created;
    },
    google: {
      insert: async () => ({
        id: 'g-1',
        htmlLink: 'https://calendar.example/g-1',
      }),
    },
  } as any);

  const form = {
    id: 'form-1',
    title: 'Survei',
    sections: [],
    eligibleAngkatan: [2025],
  };
  const forms = createFormRouter({
    getUserRoles,
    getMemberDetails: async (userId: string) => ({
      whatsapp: null,
      line: null,
      ...savedDetails.get(userId),
    }),
    saveMemberDetails: async (userId: string, change: object) => {
      savedDetails.set(userId, { ...savedDetails.get(userId), ...change });
    },
    isStoredFile: () => false,
    getFormById: async () => form,
    getFormResponsesList: async () => ({
      responses: [{ id: 'r-1', nim: '13525901', fullName: 'Member anggota-1' }],
      total: 1,
    }),
  } as any);

  // The builder's side of the same form: akademik made it.
  const manage = createFormManageRouter({
    getUserRoles,
    getFormById: async () => ({ ...form, ownerId: akademik.id }),
    getFormRelation: async (_f: unknown, userId: string) =>
      userId === akademik.id ? 'owner' : null,
    getResponsesForSummary: async () => [],
    countAudience: async () => 132,
    slugTaken: async () => false,
    createForm: async (row: any) => {
      createdForms.push(row);
      return {
        id: 'form-new',
        description: null,
        closesAt: null,
        allowEdit: false,
        thanks: null,
        slugCustom: false,
        createdAt: new Date('2026-10-08T00:00:00Z'),
        updatedAt: new Date('2026-10-08T00:00:00Z'),
        ...row,
      };
    },
    getPerson: async (userId: string) => ({
      id: userId,
      fullName: `Member ${userId}`,
      nim: '13524902',
      picture: null,
    }),
    getFormResponsesCount: async () => 0,
  } as any);

  // Posts as the database answers them: only the member's angkatan sees a post aimed at it.
  const posts = [
    { id: 'post-all', title: 'Untuk semua', angkatan: null },
    { id: 'post-2024', title: 'Untuk 2024', angkatan: 2024 },
  ].map((p) => ({
    ...p,
    content: 'Isi',
    createdAt: '2026-10-08T00:00:00Z',
    creatorId: 'someone',
    creator: { id: 'someone', fullName: 'Pengurus', picture: null },
    comments: 0,
    reactions: { totalReactions: 0, reactionsCount: [] },
  }));
  const visible = (angkatan: number) =>
    posts.filter((p) => p.angkatan === null || p.angkatan === angkatan);
  const info = createInfoRouter({
    getListInfos: async (_q: unknown, _userId: string, angkatan: number) =>
      visible(angkatan),
    getInfoById: async (id: string, _userId: string, angkatan: number) =>
      visible(angkatan).find((p) => p.id === id),
  } as any);

  const api = new OpenAPIHono();
  api.use('*', async (c, next) => {
    seen.push({
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      cookie: (c.req.header('cookie') ?? '').includes(
        'hmif-app.access-cookie=',
      ),
      origin: c.req.header('origin') ?? null,
    });
    await next();
  });
  for (const router of [calendar, forms, manage, info])
    api.route('/api', router);

  mcpApp = new OpenAPIHono();
  mcpApp.route(
    '/',
    createMcpRouter({
      dispatch: async (request) => await api.fetch(request),
      deps: store.deps,
    }),
  );
});

test('initialize and tools/list: the PIPS! tools, and no Curhat, push, upload or sign-in tool', async () => {
  const client = await connect(await grant(anggota));
  assert.equal(client.getServerVersion()?.name, 'PIPS!');
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const name of [
    'get_my_profile',
    'list_announcements',
    'post_announcement',
    'add_calendar_event',
    'submit_form',
    'get_form_responses',
    'update_my_details',
    'add_my_courses',
    'remove_my_courses',
    'renotify_announcement',
    'set_notification_category',
    'create_form',
    'update_form',
    'publish_form',
    'share_form',
  ])
    assert.ok(names.includes(name), name);
  assert.ok(
    !names.some((n) => /sparta|internship/i.test(n)),
    'Magang SPARTA is gone',
  );
  for (const t of tools) {
    assert.doesNotMatch(
      `${t.name} ${t.description ?? ''}`,
      /chatroom|push device|upload|login|bypass/i,
      t.name,
    );
    assert.doesNotMatch(t.name, /curhat/i);
    assert.equal(typeof t.annotations?.readOnlyHint, 'boolean', t.name);
  }
  for (const name of [
    'delete_announcement',
    'remove_my_courses',
    'unshare_form',
  ])
    assert.equal(
      tools.find((t) => t.name === name)?.annotations?.destructiveHint,
      true,
      name,
    );
  assert.ok(!names.includes('delete_form'), 'who may delete a form is open');
  assert.equal(
    tools.find((t) => t.name === 'list_announcements')?.annotations
      ?.readOnlyHint,
    true,
  );
  await client.close();
});

test('a token without pips.write sees and can call only the reading tools', async () => {
  const client = await connect(await grant(akademik, 'pips.read'));
  const { tools } = await client.listTools();
  assert.ok(tools.length > 0);
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
  assert.ok(!tools.some((t) => t.name === 'add_calendar_event'));
  const res = await client
    .callTool({
      name: 'add_calendar_event',
      arguments: {
        title: 'Kuis',
        start: '2026-10-09T09:00:00+07:00',
        end: '2026-10-09T10:00:00+07:00',
        category: 'akademik',
        courseId: 'course-1',
      },
    })
    .then(
      (r) => r,
      (e: Error) => ({
        isError: true,
        content: [{ type: 'text', text: e.message }],
      }),
    );
  assert.equal((res as any).isError, true);
  assert.equal(createdEvents.length, 0);
  await client.close();
});

test('a plain anggota is refused an Akademik event by the route; akademik is allowed', async () => {
  const event = {
    title: 'Kuis 1',
    start: '2026-10-09T09:00:00+07:00',
    end: '2026-10-09T10:00:00+07:00',
    category: 'akademik',
    courseId: 'course-1',
  };
  const plain = await connect(await grant(anggota));
  const refused = await plain.callTool({
    name: 'add_calendar_event',
    arguments: event,
  });
  assert.equal(refused.isError, true);
  assert.match(
    textOf(refused),
    /^403 Not allowed: .*not authorized to create academic events/,
  );
  assert.equal(createdEvents.length, 0);
  await plain.close();

  const allowed = await connect(await grant(akademik));
  const ok = await allowed.callTool({
    name: 'add_calendar_event',
    arguments: event,
  });
  assert.equal(ok.isError, undefined, textOf(ok));
  assert.equal(JSON.parse(textOf(ok)).title, 'Kuis 1');
  assert.equal(createdEvents.length, 1);
  await allowed.close();
});

test('Rekap Form: refused to a plain anggota by the route, allowed to admin', async () => {
  const plain = await connect(await grant(anggota));
  const refused = await plain.callTool({
    name: 'get_form_responses',
    arguments: { formId: 'form-1' },
  });
  assert.equal(refused.isError, true);
  assert.match(textOf(refused), /^401 .*Unauthorized/);
  await plain.close();

  const asAdmin = await connect(await grant(admin));
  const ok = await asAdmin.callTool({
    name: 'get_form_responses',
    arguments: { formId: 'form-1' },
  });
  assert.equal(ok.isError, undefined, textOf(ok));
  assert.equal(JSON.parse(textOf(ok)).total, 1);
  await asAdmin.close();
});

test("a form's summary: refused to anggota and to a pengurus it isn't shared with, given to its maker", async () => {
  const plain = await connect(await grant(anggota));
  const refused = await plain.callTool({
    name: 'get_form_summary',
    arguments: { formId: 'form-1' },
  });
  assert.match(textOf(refused), /^401 /);
  await plain.close();

  const maker = await connect(await grant(akademik));
  const ok = await maker.callTool({
    name: 'get_form_summary',
    arguments: { formId: 'form-1' },
  });
  assert.equal(ok.isError, undefined, textOf(ok));
  assert.deepEqual(JSON.parse(textOf(ok)), { total: 0, audience: 132 });
  await maker.close();
});

test("tools see Pengumuman as the member's own angkatan does", async () => {
  const plain = await connect(await grant(anggota));
  const list = JSON.parse(
    textOf(await plain.callTool({ name: 'list_announcements', arguments: {} })),
  );
  assert.deepEqual(
    list.map((p: { id: string }) => p.id),
    ['post-all'],
  );
  const other = await plain.callTool({
    name: 'get_announcement',
    arguments: { announcementId: 'post-2024' },
  });
  assert.equal(other.isError, true);
  assert.match(textOf(other), /^404 /);
  await plain.close();

  const for2024 = await connect(await grant(akademik));
  const list2024 = JSON.parse(
    textOf(
      await for2024.callTool({ name: 'list_announcements', arguments: {} }),
    ),
  );
  assert.deepEqual(
    list2024.map((p: { id: string }) => p.id),
    ['post-all', 'post-2024'],
  );
  // Compact: what the route sent, without empty lists or nulls, and no field it didn't send.
  assert.deepEqual(Object.keys(list2024[0]).sort(), [
    'author',
    'comments',
    'content',
    'createdAt',
    'id',
    'reactions',
    'title',
  ]);
  await for2024.close();
});

test('tools reach routes with the member’s session cookie and no Origin, as a request from this process', () => {
  assert.ok(seen.length > 0);
  for (const r of seen) {
    assert.equal(r.cookie, true);
    assert.equal(r.origin, null);
  }
});

test('a member removed from users, or a revoked token, can no longer connect', async () => {
  const gone = testUser('gone-1', { nim: '13525904' });
  store.users[gone.id] = gone;
  const token = await grant(gone);
  delete store.users[gone.id];
  await assert.rejects(connect(token));

  const revocable = await grant(anggota);
  await store.deps.revokeApp(anggota.id, 'client-1', store.clock.now);
  await assert.rejects(connect(revocable));
});

test("Data diri: a tool changes only the member's own details, through PATCH, and the route's checks refuse a bad one", async () => {
  const client = await connect(await grant(anggota));
  const ok = await client.callTool({
    name: 'update_my_details',
    arguments: { whatsapp: '0812 3456 7890' },
  });
  assert.equal(ok.isError, undefined, textOf(ok));
  assert.equal(JSON.parse(textOf(ok)).saved.whatsapp, '0812 3456 7890');
  assert.deepEqual(savedDetails.get(anggota.id), {
    whatsapp: '0812 3456 7890',
  });
  assert.ok(
    seen.some(
      (r) => r.method === 'PATCH' && r.path === '/api/user/details' && r.cookie,
    ),
  );

  const refused = await client.callTool({
    name: 'update_my_details',
    arguments: { whatsapp: '12' },
  });
  assert.equal(refused.isError, true);
  assert.match(textOf(refused), /^400 Bad request: .*phone/);
  assert.equal(savedDetails.get(anggota.id)?.whatsapp, '0812 3456 7890');
  await client.close();
});

test('making a form: refused to a plain anggota by the route, a draft owned by the pengurus who asked', async () => {
  const plain = await connect(await grant(anggota));
  const refused = await plain.callTool({
    name: 'create_form',
    arguments: { title: 'Daftar panitia' },
  });
  assert.equal(refused.isError, true);
  assert.match(textOf(refused), /^401 /);
  assert.equal(createdForms.length, 0);
  await plain.close();

  const pengurus = await connect(await grant(akademik));
  const ok = await pengurus.callTool({
    name: 'create_form',
    arguments: { title: 'Daftar panitia' },
  });
  assert.equal(ok.isError, undefined, textOf(ok));
  const made = JSON.parse(textOf(ok));
  assert.equal(made.title, 'Daftar panitia');
  assert.equal(made.publishedAt, undefined, 'a draft');
  assert.deepEqual(
    createdForms.map((f) => [f.ownerId, f.title]),
    [[akademik.id, 'Daftar panitia']],
  );
  await pengurus.close();
});
