import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NimResults } from '../src/routes/_app/_left-navbar/layanan/nim/-components/nim-results';

// Regression (P0-D review minor 7): the key sat on UserInfo, not on each row's outer element, so React warned
// that the rows had no key.
test("NIM Finder's rows are keyed, and show name, programme and NIM", () => {
  const warnings: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  let html: string;
  try {
    html = renderToString(
      createElement(NimResults, {
        results: [
          {
            fullName: 'Nadia Putri',
            nim: '13525045',
            major: 'IF',
            picture: null,
          },
          {
            fullName: 'Raka Pratama',
            nim: '18224045',
            major: 'STI',
            picture: null,
          },
        ],
      }),
    );
  } finally {
    console.error = original;
  }
  assert.deepEqual(warnings, []);
  for (const text of [
    'Nadia Putri',
    '13525045',
    'Teknik Informatika',
    'Raka Pratama',
    'Sistem dan Teknologi Informasi',
  ])
    assert.ok(html.includes(text), text);
});
