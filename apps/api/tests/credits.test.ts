import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREDIT_PHOTOS_LIMIT, creditNims } from '../src/lib/credits';

test('creditNims: every student number in the credits, each once, in order', () => {
  const content = [
    '# Credits',
    '## Redesign',
    '### Lead & Implementer',
    "Sari Wulandari - STI'23 - 18223901",
    '## Panitia Khusus',
    '### Frontend',
    '#### Lead',
    "Bima Saputra - IF'21 - 13521902",
    '#### Team',
    "Sari Wulandari - STI'23 - 18223901",
  ].join('\n');
  assert.deepEqual(creditNims(content), ['18223901', '13521902']);
});

test('creditNims: only numbers of exactly eight digits', () => {
  assert.deepEqual(creditNims('1352190 135219011 2024 13521903'), ['13521903']);
  assert.deepEqual(creditNims('no numbers here'), []);
});

test('creditNims: bounded', () => {
  const many = Array.from({ length: CREDIT_PHOTOS_LIMIT + 50 }, (_, i) =>
    String(13_521_000 + i),
  ).join(' ');
  assert.equal(creditNims(many).length, CREDIT_PHOTOS_LIMIT);
});
