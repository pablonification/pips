// The e2e harness answers forms, SPARTA, Curhat's unread count and NIM Finder as the API does since P0-D.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDb, type Db } from '../e2e/fixtures/api';
import { defaultHandlers } from '../e2e/support/handlers';
import type { MockRequest } from '../e2e/support/mock';
import * as writes from '../e2e/support/writes';

function call(
  handler: (req: MockRequest) => unknown,
  db: Db,
  {
    params = {},
    query = '',
    body,
  }: { params?: Record<string, string>; query?: string; body?: unknown } = {},
) {
  return handler({
    db,
    params,
    query: new URLSearchParams(query),
    body,
  } as unknown as MockRequest) as Record<string, unknown> & {
    status?: number;
    body?: unknown;
  };
}
const get = (route: string) => defaultHandlers[`GET ${route}`];

test('form list: status, sectionCount and closesAt; the detail carries status', () => {
  const db = buildDb('anggota');
  const forms = call(get('/api/form'), db).forms as Array<
    Record<string, unknown>
  >;
  assert.equal(forms[0].status, 'open');
  assert.equal(forms[0].sectionCount, db.formDetails.pixel.sections!.length);
  assert.equal(forms[0].closesAt, null);
  assert.equal('sections' in forms[0], false);
  const detail = call(get('/api/form/:formId'), db, {
    params: { formId: 'pixel' },
  });
  assert.equal(detail.status, 'open');
  assert.ok(Array.isArray(detail.sections));
});

test('a closed form keeps its questions, reads as closed, and refuses answers with 403', () => {
  const db = buildDb('anggota');
  db.formDetails.pixel.closesAt = '2026-10-01T00:00:00.000Z';
  const detail = call(get('/api/form/:formId'), db, {
    params: { formId: 'pixel' },
  });
  assert.equal(detail.status, 'closed');
  assert.ok(Array.isArray(detail.sections));
  const sent = call(writes.submitForm, db, {
    params: { formId: 'pixel' },
    body: { answers: [] },
  });
  assert.equal(sent.status, 403);
  db.formDetails.pixel.closesAt = null;
  db.formDetails.pixel.isActive = false;
  assert.equal(
    call(writes.submitForm, db, {
      params: { formId: 'pixel' },
      body: { answers: [] },
    }).status,
    403,
  );
});

test('a form not open yet has no questions', () => {
  const db = buildDb('anggota');
  db.formDetails.pixel.opensAt = '2026-10-10T06:00:00.000Z';
  const detail = call(get('/api/form/:formId'), db, {
    params: { formId: 'pixel' },
  });
  assert.equal(detail.status, 'not_opened');
  assert.equal(detail.sections, null);
});

// Regression (review M2): a form switched off before it opened is closed, and its questions stay hidden.
test('a switched-off form keeps its questions hidden until it opens', () => {
  const db = buildDb('anggota');
  db.formDetails.pixel.opensAt = '2026-12-01T06:00:00.000Z';
  db.formDetails.pixel.isActive = false;
  const detail = call(get('/api/form/:formId'), db, {
    params: { formId: 'pixel' },
  });
  assert.equal(detail.status, 'closed');
  assert.equal(detail.sections, null);
});

test('PIXEL q1 and q2 ask for prefill', () => {
  const q = buildDb('anggota').formDetails.pixel.sections!.flatMap(
    (s) => s.questions,
  );
  assert.deepEqual(
    q.filter((x) => x.prefill).map((x) => [x.id, x.prefill]),
    [
      ['q1', 'fullName'],
      ['q2', 'nim'],
    ],
  );
});

// Regression: the harness answered 404 when a member had no SPARTA submission; the API answers 200 null.
test('SPARTA: 200 null without a submission, 401 for a member it is not for, and the window', () => {
  const nadia = buildDb('anggota');
  nadia.internshipSubmissions = [];
  assert.equal(call(get('/api/internship/submission'), nadia), null);
  const raka = buildDb('pengurus');
  assert.equal(call(get('/api/internship/submission'), raka).status, 401);
  assert.deepEqual(call(get('/api/internship/window'), nadia), {
    opensAt: null,
    closesAt: '2026-08-23T16:59:00.000Z',
    status: 'closed',
    eligible: true,
  });
  assert.equal(call(get('/api/internship/window'), raka).eligible, false);
});

test('SPARTA writes: 403 while closed; a partial draft saves once open; sending needs it all and locks', () => {
  const db = buildDb('anggota');
  const draft = { kelas: '', idLine: '', kesibukan: [], choices: [] };
  assert.equal(call(writes.saveSpartaDraft, db, { body: draft }).status, 403);
  db.spartaWindow = { opensAt: null, closesAt: '2026-10-31T16:59:00.000Z' };
  assert.equal(
    call(writes.saveSpartaDraft, db, { body: draft }).isLocked,
    false,
  );
  assert.equal(call(writes.submitSparta, db, { body: draft }).status, 400);
  const full = {
    kelas: 'IF K2',
    idLine: 'nadia.p',
    kesibukan: [],
    choices: [1, 2, 3, 4].map((n) => ({
      divisionId: `d${n}`,
      priorityOrder: n,
      answers: [],
    })),
  };
  assert.equal(call(writes.submitSparta, db, { body: full }).isLocked, true);
  assert.equal(call(writes.saveSpartaDraft, db, { body: full }).status, 409);
});

test('Curhat unread: only messages from others without a read mark; reading clears it', () => {
  const db = buildDb('anggota');
  assert.deepEqual(call(get('/api/curhat/chatrooms/unread'), db), [
    { chatroomId: 'r1', unreadCount: 1 },
  ]);
  call(writes.readRoom, db, { params: { chatroomId: 'r1' } });
  assert.deepEqual(call(get('/api/curhat/chatrooms/unread'), db), []);
  assert.equal(
    call(writes.readRoom, db, { params: { chatroomId: 'nope' } }).status,
    404,
  );
});

test('Curhat rooms: a fourth is refused with 400', () => {
  const db = buildDb('anggota');
  assert.equal(call(writes.createRoom, db).status, 201);
  assert.equal(call(writes.createRoom, db).status, 400);
});

test('NIM Finder: four fields, closest NIM first, 400 under three characters', () => {
  const db = buildDb('anggota');
  const rows = call(get('/api/user/nim'), db, {
    query: 'search=Rak',
  }) as unknown as Array<Record<string, unknown>>;
  assert.ok(rows.length >= 2);
  for (const r of rows)
    assert.deepEqual(Object.keys(r).sort(), [
      'fullName',
      'major',
      'nim',
      'picture',
    ]);
  const names = rows.map((r) => r.fullName as string);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  );
  const nim = db.members[0].nim;
  const byNim = call(get('/api/user/nim'), db, {
    query: `search=${nim}`,
  }) as unknown as Array<Record<string, unknown>>;
  assert.equal(byNim[0].nim, nim);
  assert.equal(
    call(get('/api/user/nim'), db, { query: 'search=%20ra%20' }).status,
    400,
  );
});
