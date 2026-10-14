// The review package's index builder (e2e/scripts/lib/review/index.mjs) on a small fake data set: every text
// escaped; only relative links to files inside the package; nothing loaded over http or https; the placeholder line
// for each video and image when media/ is missing; the step-time links; and data blocks that can't close a script.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeData } from '../e2e/scripts/lib/review/fake.mjs';
import {
  CSS,
  JS,
  buildIndex,
  esc,
  jsonBlock,
  rel,
  tag,
} from '../e2e/scripts/lib/review/index.mjs';

const html = buildIndex(/** @type {any} */ (fakeData()));

test('text is escaped: no tag from the data reaches the page', () => {
  assert.equal(esc('<b>"&\''), '&#60;b&#62;&#34;&#38;&#39;');
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&#60;script&#62;x&#60;/script&#62;'));
  assert.ok(!html.includes('<b>on today</b>'));
  assert.ok(html.includes('A &#60;fake&#62; finding &#38; more'));
});

test('links and sources are paths inside the package; anything else is refused', () => {
  assert.equal(
    rel('media/flows/beranda/phone light.mp4'),
    'media/flows/beranda/phone%20light.mp4',
  );
  for (const bad of [
    'https://example.org/x.png',
    'http://x',
    '/etc/passwd',
    '../outside.png',
    'media/../../x',
    'file:///x',
    'javascript:alert(1)',
  ])
    assert.throws(() => rel(bad), /inside the package/, bad);
  const targets = [...html.matchAll(/\b(?:src|href|poster)="([^"]*)"/g)].map(
    (m) => m[1],
  );
  assert.ok(targets.length > 10);
  for (const t of targets)
    assert.ok(t.startsWith('#') || !/^[a-z][a-z0-9+.-]*:|^\//i.test(t), t);
});

test('nothing loads over http or https: no external fonts, scripts, styles or images', () => {
  assert.ok(!/(src|href|poster)="https?:/i.test(html));
  assert.ok(!/@import|url\(\s*['"]?https?:/i.test(html));
  assert.ok(!/fetch\(|XMLHttpRequest|type="module"/.test(html + JS));
  assert.ok(html.includes('<script src="assets/review.js"></script>'));
});

test('each video and image carries its placeholder line naming the release file', () => {
  const media = [...html.matchAll(/<(img|video)\b[^>]*data-media[^>]*>/g)].map(
    (m) => m[0],
  );
  assert.ok(media.length >= 6);
  for (const m of media)
    assert.match(
      m,
      /data-missing="Not in this copy: download review-2026-10-14\.zip from the release/,
    );
  assert.ok(html.includes('data-release="review-2026-10-14.zip"'));
  assert.ok(JS.includes("probe.src = 'media/present.webp'"));
  assert.ok(html.includes('preload="none"'));
});

test('each step jumps to its time', () => {
  assert.ok(
    html.includes(
      '<button type="button" class="link" data-t="0">0:00</button> Beranda opens',
    ),
  );
  assert.ok(
    html.includes('data-t="1.2">0:01</button> Sabtu shows Bakti Sosial HMIF'),
  );
});

test('a data block can’t close its script; status is a word and a mark, not colour alone', () => {
  assert.ok(!jsonBlock({ a: '</script><b>' }).includes('</script>'));
  assert.equal(JSON.parse(jsonBlock({ a: '</script>&' })).a, '</script>&');
  assert.match(tag('passed'), /✓.*Passed/);
  assert.match(tag('expected-failure'), /✕.*Fails \(known finding\)/);
});

test('the summary lists blockers without recommending; security items are tagged', () => {
  assert.ok(html.includes('it doesn’t recommend'));
  assert.ok(html.includes('Flow “Global search” fails: F1-1: fake'));
  assert.match(html, /C3<\/strong>.*security/);
});

test('a finding a later merge fixed is no blocker (F1-2, fixed by C1)', () => {
  const d = /** @type {any} */ (fakeData());
  d.findings = [
    { id: 'F1-7', title: 'Still broken', flows: [] },
    { id: 'F1-8', title: 'Fixed since', flows: [], fixed: 'Fixed by C1.' },
  ];
  const page = buildIndex(d);
  const blockers = page.slice(page.indexOf('Blockers and findings'));
  assert.ok(blockers.includes('F1-7: Still broken'));
  assert.ok(!blockers.includes('F1-8: Fixed since'));
});

test('every table sits in a scroll region the keyboard can reach (axe scrollable-region-focusable at 390 px)', () => {
  const tables = html.match(/<table>/g) ?? [];
  const wrapped =
    html.match(
      /<div class="tscroll" role="region" tabindex="0" aria-label="[^"]+"><table>/g,
    ) ?? [];
  assert.ok(tables.length >= 1);
  assert.equal(wrapped.length, tables.length);
});

test('a select never widens the page past a phone (F1 part 2: the recording switch at 390 px)', () => {
  assert.match(CSS, /select\{max-width:100%\}/);
  // Long paths in the open questions wrap instead of widening the list.
  assert.match(CSS, /main\{overflow-wrap:break-word\}/);
});
