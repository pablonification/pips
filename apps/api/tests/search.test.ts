import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { prefixTsQuery } from '../src/lib/search';

test('words become prefixes that must all match, as before', () => {
  assert.equal(prefixTsQuery('algo'), 'algo:*');
  assert.equal(prefixTsQuery('  kuis   basis '), 'kuis:* & basis:*');
  assert.equal(prefixTsQuery('IF2211'), 'IF2211:*');
  assert.equal(
    prefixTsQuery('Ujian Tengah Semester'),
    'Ujian:* & Tengah:* & Semester:*',
  );
});

// These must not go into to_tsquery as typed: that gives a 500.
test('tsquery syntax in the text is dropped, never passed on', () => {
  assert.equal(prefixTsQuery('C++'), 'C:*');
  assert.equal(
    prefixTsQuery("Jum'at (pagi) & !malam:"),
    'Jum:* & at:* & pagi:* & malam:*',
  );
  assert.equal(prefixTsQuery('kafé'), 'kafé:*');
  for (const text of [
    '(',
    '&',
    '!',
    ':',
    "'",
    '|',
    '<->',
    ':*',
    '\\',
    '   ',
    '',
  ]) {
    assert.equal(prefixTsQuery(text), null, JSON.stringify(text));
  }
});
