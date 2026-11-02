import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { tiltAt } from '../src/features/profil/member-tilt';

/* The member card's tilt (Garis v5): at most 8° sideways and 6° up or down; the sheen follows the pointer across. */

const card = { left: 100, top: 50, width: 360, height: 227 };

test('the middle of the card: flat, the sheen in the middle', () => {
  assert.deepEqual(tiltAt(card, 280, 163.5), { rx: 0, ry: 0, mx: 50 });
});

test('the corners lean toward the pointer, at most 8° and 6°', () => {
  // Top left: the left edge comes forward (rotateY −8°), the top tips back (rotateX +6°).
  assert.deepEqual(tiltAt(card, 100, 50), { rx: -8, ry: 6, mx: 0 });
  assert.deepEqual(tiltAt(card, 460, 277), { rx: 8, ry: -6, mx: 100 });
});

test('a pointer beyond the card counts as on its edge, so the tilt never passes 8°', () => {
  for (const [x, y] of [
    [-500, -500],
    [5000, 5000],
    [280, -40],
    [9999, 163],
  ]) {
    const t = tiltAt(card, x, y);
    assert.ok(Math.abs(t.rx) <= 8 && Math.abs(t.ry) <= 6, JSON.stringify(t));
    assert.ok(t.mx >= 0 && t.mx <= 100);
  }
});

test('a card with no size yet stays flat', () => {
  assert.deepEqual(
    tiltAt({ left: 0, top: 0, width: 0, height: 0 }, 10, 10),
    { rx: 0, ry: 0, mx: 50 },
  );
});
