import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fileHref } from '../src/lib/file-link';

const STORAGE = 'https://media.hmif.dev';

test('an http(s) address links, as it is', () => {
  assert.equal(
    fileHref('https://files.hmif.dev/portofolio.pdf'),
    'https://files.hmif.dev/portofolio.pdf',
  );
  assert.equal(
    fileHref('http://files.hmif.dev/a.pdf?x=1#p'),
    'http://files.hmif.dev/a.pdf?x=1#p',
  );
  assert.equal(
    fileHref('HTTPS://Files.HMIF.dev/CV.pdf'),
    'https://files.hmif.dev/CV.pdf',
  );
  // Spaces around the stored answer don't matter.
  assert.equal(
    fileHref('  https://files.hmif.dev/a.pdf \n'),
    'https://files.hmif.dev/a.pdf',
  );
});

test('script, data and other schemes never link, in any case or disguise', () => {
  for (const answer of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'JAVASCRIPT:alert(document.cookie)',
    ' javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    'javascript\u0000:alert(1)',
    '\u0001javascript:alert(1)',
    'jav&#x09;ascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://files.hmif.dev/1234',
    'ftp://files.hmif.dev/a.pdf',
    'mailto:a@b.c',
  ]) {
    assert.equal(fileHref(answer), null, JSON.stringify(answer));
    assert.equal(fileHref(answer, STORAGE), null, JSON.stringify(answer));
  }
});

test('relative, protocol-relative and look-alike addresses never link', () => {
  for (const answer of [
    '//evil.example/a.pdf',
    '///evil.example/a.pdf',
    '\\\\evil.example\\a.pdf',
    '/\\evil.example',
    'https:\\\\evil.example',
    'https:/evil.example',
    'https:evil.example',
    'https:///evil.example',
    '/media/a.pdf',
    'portofolio.pdf',
    'files.hmif.dev/a.pdf',
    'https://user:pass@files.hmif.dev/a.pdf',
    'https://files.hmif.dev@evil.example/a.pdf',
    'https://files.hmif.dev/a b.pdf',
    'https://files.hmif.dev/a b.pdf',
    'https://files.hmif.dev/a .pdf',
    'https://',
    'https://[',
    '',
    '   ',
  ]) {
    assert.equal(fileHref(answer), null, JSON.stringify(answer));
  }
  assert.equal(fileHref(null), null);
  assert.equal(fileHref(undefined), null);
});

test("with the app's storage known, only files under it link", () => {
  assert.equal(
    fileHref('https://media.hmif.dev/sparta/cv.pdf', STORAGE),
    'https://media.hmif.dev/sparta/cv.pdf',
  );
  assert.equal(
    fileHref('HTTPS://MEDIA.HMIF.DEV/sparta/cv.pdf', STORAGE),
    'https://media.hmif.dev/sparta/cv.pdf',
  );
  for (const answer of [
    'https://files.hmif.dev/cv.pdf',
    'http://media.hmif.dev/sparta/cv.pdf', // another origin: http, not https
    'https://media.hmif.dev:8443/cv.pdf',
    'https://media.hmif.dev.evil.example/cv.pdf',
    'https://evilmedia.hmif.dev/cv.pdf',
    'https://media.hmif.dev@evil.example/cv.pdf',
  ]) {
    assert.equal(fileHref(answer, STORAGE), null, answer);
  }
});

test('a storage address with a path keeps files to that path', () => {
  const base = 'https://cdn.example/pips/';
  assert.equal(
    fileHref('https://cdn.example/pips/a.pdf', base),
    'https://cdn.example/pips/a.pdf',
  );
  assert.equal(
    fileHref('https://cdn.example/pips/a.pdf', 'https://cdn.example/pips'),
    'https://cdn.example/pips/a.pdf',
  );
  assert.equal(fileHref('https://cdn.example/pipsx/a.pdf', base), null);
  assert.equal(fileHref('https://cdn.example/other/a.pdf', base), null);
  assert.equal(fileHref('https://cdn.example/pips/../other/a.pdf', base), null);
});

test('an unreadable storage setting links nothing; an empty one falls back to http(s)', () => {
  assert.equal(fileHref('https://media.hmif.dev/a.pdf', 'not-specified'), null);
  assert.equal(fileHref('https://media.hmif.dev/a.pdf', 'javascript:x'), null);
  assert.equal(
    fileHref('https://media.hmif.dev/a.pdf', ''),
    'https://media.hmif.dev/a.pdf',
  );
  assert.equal(
    fileHref('https://media.hmif.dev/a.pdf', '  '),
    'https://media.hmif.dev/a.pdf',
  );
});
