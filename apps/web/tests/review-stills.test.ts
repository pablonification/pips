// The stills (e2e/review/stills.ts): the plain-Node parser review.mjs uses reads every capture name as the
// TypeScript one does; F1's own states have unique ids; the app's icons listed are the files the app ships.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseStill } from '../e2e/scripts/lib/review/stills.mjs';
import {
  APP_ICONS,
  OLD_ICONS,
  STILL_SOURCES,
  STILL_STATES,
} from '../e2e/review/stills';

const SAMPLES: Record<string, string[]> = {
  'P1-C': [
    'phone-masuk-light.png',
    'desk-notif-diblokir-dark.png',
    'tablet-pasang-iphone-light.png',
  ],
  'P2-C': [
    'phone-p2c-gagal-dark.png',
    'desk-p2c-mengirim-reply-chip-light.png',
  ],
  'P3-C': ['tablet-menu-sematkan-dark.png'],
  'P3-B': ['desk-lomba-tambah-galat-light.png'],
  'P2-A': [
    'phone-light-320-sparta-start.png',
    'desktop-dark-1440-sparta-sent.png',
  ],
  F1: ['phone-kelola-rekap-light.png', 'desktop-route-error-dark.png'],
};

test('both parsers read every capture name alike', () => {
  for (const src of STILL_SOURCES)
    for (const file of SAMPLES[src.id]) {
      const ts = src.parse(file);
      const mjs = parseStill(src.id, file);
      assert.ok(ts, `${src.id}: ${file}`);
      // P2-A's names carry the width; the review keeps it in the state so 320 px stays apart from 390 px.
      assert.deepEqual(
        mjs && { layout: mjs.layout, theme: mjs.theme },
        { layout: ts.layout, theme: ts.theme },
        `${src.id}: ${file}`,
      );
    }
  assert.equal(parseStill('P1-C', 'phone-masuk.png'), null);
});

test('F1’s states have unique ids, a source and an owner', () => {
  const ids = STILL_STATES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of STILL_STATES)
    assert.ok(s.owner && s.source && s.path.startsWith('/'), s.id);
});

test('the icons listed are the files the app ships; the old ones are listed apart', () => {
  const pub = path.resolve(import.meta.dirname, '..', 'public');
  for (const i of APP_ICONS)
    assert.ok(existsSync(path.join(pub, i.file)), i.file);
  for (const f of OLD_ICONS) assert.ok(!APP_ICONS.some((i) => i.file === f), f);
});
