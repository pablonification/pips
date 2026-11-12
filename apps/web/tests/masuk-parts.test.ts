import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { halftoneSquares } from '../src/components/garis/halftone-geometry';
import { halftoneRow, KEY_PATHS } from '../src/features/masuk/parts';

/*
 * V5 Masuk draws its header's glyphs and halftone itself, to keep /login out of the build's shared `ui` chunk
 * (parts.tsx). These keep them the Garis set's own.
 */

const ICONS = path.resolve(import.meta.dirname, '../src/components/icons');

/** The paths of one exported component in a generated icon file, in order, with their class. */
function paths(file: string, component: string): [string | null, string][] {
  const src = fs.readFileSync(path.join(ICONS, `${file}.tsx`), 'utf8');
  const at = src.indexOf(`export function ${component}(`);
  assert.notEqual(at, -1, `${file}.tsx has ${component}`);
  const body = src.slice(at, src.indexOf('\n}\n', at));
  return [
    ...body.matchAll(/<path\s+(?:className="(\w+)"\s+)?d="([^"]+)"/g),
  ].map((m) => [m[1] ?? null, m[2]]);
}

test("the service keys' glyphs are Beranda's two-tone glyphs, path for path", () => {
  for (const [key, file] of [
    ['folder', 'folder'],
    ['testi', 'testi'],
    ['nim', 'nim'],
    ['lomba', 'lomba'],
    ['curhat', 'curhat'],
    ['form', 'form'],
  ] as const) {
    const name = `Glyph${file[0].toUpperCase()}${file.slice(1)}`;
    assert.deepEqual(KEY_PATHS[key], paths(file, name), key);
  }
});

test('Pengumuman and Kalender are their icons’ lines over fills (MK_FILL)', () => {
  assert.deepEqual(KEY_PATHS.pengumuman, [
    ['gf', 'M3.5 9h4L14 5v14l-6.5-4h-4z'],
    ...paths('pengumuman', 'IconPengumuman'),
  ]);
  assert.deepEqual(KEY_PATHS.kalender, [
    ['gf', 'M3.5 5.5h17V10h-17z'],
    ...paths('kalender', 'IconKalender'),
  ]);
});

test('the halftone is halftone-geometry’s, at the header’s lengths', () => {
  for (const length of [216, 240, 360])
    assert.deepEqual(halftoneRow(length), halftoneSquares(length), `${length}`);
});
