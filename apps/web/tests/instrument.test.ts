import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { sentryOptions } from '../src/instrument';

/*
 * What an error report may carry about where the member was: no search text (NIM Finder's, global search's), no
 * Curhat room ids, no socket ids. The report is scrubbed just before it is sent, breadcrumbs as they are recorded.
 */

const options = sentryOptions('https://key@sentry.example/1');
const ROOM = '7f3c2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6';

test('only error reports and traces are switched on: no session replays, no profiling', () => {
  const keys = Object.keys(options);
  for (const key of keys) assert.doesNotMatch(key, /replay|profil/i, key);
  assert.equal(options.integrations, undefined);
});

test('a report keeps the page, without its search or a Curhat room', () => {
  const event = {
    request: {
      url: `https://app.hmif.dev/layanan/curhat/${ROOM}?from=beranda#akhir`,
      query_string: 'from=beranda',
      headers: {
        Referer: 'https://app.hmif.dev/layanan/nim?q=Nadia',
        'User-Agent': 'Mozilla/5.0',
      },
    },
    breadcrumbs: [
      {
        category: 'navigation',
        data: {
          from: '/layanan/nim?q=PRIVATE-SEARCH-NAME',
          to: `/kelola/curhat/${ROOM}`,
        },
      },
      {
        category: 'fetch',
        data: {
          method: 'GET',
          url: 'https://app-api.hmif.dev/api/user/nim?search=PRIVATE-SEARCH-NAME',
          status_code: 200,
        },
      },
      {
        category: 'xhr',
        data: {
          method: 'GET',
          url: `https://app-api.hmif.dev/socket.io/?EIO=4&transport=polling&sid=abc123`,
        },
      },
      {
        category: 'fetch',
        data: {
          method: 'GET',
          url: `https://app-api.hmif.dev/api/curhat/chatroom/${ROOM}`,
        },
      },
      { category: 'console', message: 'kept as it is' },
    ],
  } as unknown as ErrorEvent;
  const sent = options.beforeSend!(event, {}) as ErrorEvent;
  const text = JSON.stringify(sent);
  for (const secret of [
    'PRIVATE-SEARCH-NAME',
    'Nadia',
    ROOM,
    'abc123',
    'beranda',
    'akhir',
  ])
    assert.ok(!text.includes(secret), secret);
  assert.equal(sent.request?.url, 'https://app.hmif.dev/layanan/curhat/:id');
  assert.equal(sent.request?.query_string, undefined);
  assert.equal(
    sent.request?.headers?.Referer,
    'https://app.hmif.dev/layanan/nim',
  );
  assert.equal(sent.request?.headers?.['User-Agent'], 'Mozilla/5.0');
  assert.deepEqual(
    sent.breadcrumbs?.map((b) => b.data),
    [
      { from: '/layanan/nim', to: '/kelola/curhat/:id' },
      {
        method: 'GET',
        url: 'https://app-api.hmif.dev/api/user/nim',
        status_code: 200,
      },
      { method: 'GET', url: 'https://app-api.hmif.dev/socket.io/' },
      {
        method: 'GET',
        url: 'https://app-api.hmif.dev/api/curhat/chatroom/:id',
      },
      undefined,
    ],
  );
  assert.equal(sent.breadcrumbs?.[4].message, 'kept as it is');
});

test('a breadcrumb is scrubbed as it is recorded', () => {
  const crumb: Breadcrumb = {
    category: 'navigation',
    data: { from: '/cari?q=rahasia', to: `/layanan/curhat/${ROOM}` },
  };
  const kept = options.beforeBreadcrumb!(crumb) as Breadcrumb;
  assert.deepEqual(kept.data, { from: '/cari', to: '/layanan/curhat/:id' });
  // Pages that aren't a room keep their path.
  const other = options.beforeBreadcrumb!({
    category: 'navigation',
    data: { from: '/layanan/curhat', to: '/kelola/curhat' },
  }) as Breadcrumb;
  assert.deepEqual(other.data, {
    from: '/layanan/curhat',
    to: '/kelola/curhat',
  });
});
