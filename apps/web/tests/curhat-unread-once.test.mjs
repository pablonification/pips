// P2-C review minor 7: Curhat's unread query was defined three times (Curhat, Layanan, Beranda) on one key. It is
// defined once, in src/api/queries.ts (`curhatUnreadQuery`), and every screen uses that one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const src = path.resolve(import.meta.dirname, '../src');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

test('the unread request is made in one place: curhatUnreadQuery in src/api/queries.ts', () => {
  const callers = files(src)
    .filter((f) =>
      fs.readFileSync(f, 'utf8').includes('unreadCountChatroomMessages('),
    )
    .map((f) => path.relative(src, f));
  // Welfare's screen from before the redesign (layanan/curhat/-components, until P3-C) doesn't read the counts.
  assert.deepEqual(callers, ['api/queries.ts']);
  const defs = files(src)
    .filter((f) =>
      /export const curhatUnreadQuery\b/.test(fs.readFileSync(f, 'utf8')),
    )
    .map((f) => path.relative(src, f));
  assert.deepEqual(defs, ['api/queries.ts']);
});
