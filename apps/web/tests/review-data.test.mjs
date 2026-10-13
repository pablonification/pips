// The review command's pure parts (e2e/scripts/lib/review/data.mjs): the recordings a flow makes, the grep that picks
// a flow, Playwright's JSON report read as rows and counts, a recording's result, the owner of each locked screen,
// the reason a report gives for a different screen, and the lab's medians against SPEC's budgets.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countsByProject,
  deviationFor,
  flowGrep,
  flowOfTitle,
  labSummary,
  median,
  ownerOfScreen,
  plannedRecordings,
  recordingStatus,
  releaseName,
  resultsOf,
} from '../e2e/scripts/lib/review/data.mjs';

const flow = {
  id: 'layanan',
  themes: ['light', 'dark'],
  variants: [
    { key: 'nadia', who: 'Nadia', layouts: ['phone', 'desktop'] },
    { key: 'raka', who: 'Raka', layouts: ['phone'] },
  ],
};

test('a flow’s recordings in a theme: its variants at their layouts, named for the variant when there are two', () => {
  assert.deepEqual(
    plannedRecordings(flow, 'dark').map((r) => [r.project, r.file]),
    [
      ['review-phone-dark', 'media/flows/layanan/phone-dark-nadia.mp4'],
      ['review-desktop-dark', 'media/flows/layanan/desktop-dark-nadia.mp4'],
      ['review-phone-dark', 'media/flows/layanan/phone-dark-raka.mp4'],
    ],
  );
  assert.deepEqual(plannedRecordings({ ...flow, themes: ['light'] }, 'dark'), []);
  const one = { id: 'beranda', themes: ['light'], variants: [{ key: 'nadia', who: 'Nadia', layouts: ['tablet'] }] };
  assert.equal(plannedRecordings(one, 'light')[0].poster, 'media/flows/beranda/tablet-light.webp');
});

test('the grep picks one flow, not a flow whose id starts the same', () => {
  const re = new RegExp(flowGrep('beranda'));
  assert.ok(re.test('Beranda [beranda:nadia] @flow:beranda'));
  assert.ok(!re.test('Raka’s Beranda [beranda-pengurus:raka] @flow:beranda-pengurus'));
  assert.deepEqual(flowOfTitle('x › Beranda [beranda-push:nadia] @flow:beranda-push'), { flow: 'beranda-push', variant: 'nadia' });
});

const REPORT = {
  suites: [
    {
      title: 'flows/a.flow.ts',
      file: 'flows/a.flow.ts',
      specs: [],
      suites: [
        {
          title: 'beranda · Nadia',
          specs: [
            {
              title: 'Beranda [beranda:nadia] @flow:beranda',
              tests: [
                { projectName: 'review-phone-light', expectedStatus: 'passed', results: [{ status: 'passed', duration: 9 }] },
                { projectName: 'review-tablet-light', expectedStatus: 'failed', results: [{ status: 'failed', duration: 9 }] },
                { projectName: 'review-desktop-light', expectedStatus: 'passed', results: [{ status: 'timedOut', duration: 9 }] },
                { projectName: 'review-phone-dark', expectedStatus: 'passed', results: [{ status: 'skipped', duration: 0 }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test('Playwright’s JSON as rows and counts per project; each recording’s result', () => {
  const rows = resultsOf(REPORT);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].title, 'beranda · Nadia › Beranda [beranda:nadia] @flow:beranda');
  assert.equal(rows[0].file, 'flows/a.flow.ts');
  const c = countsByProject(rows);
  assert.deepEqual(c['review-phone-light'], { passed: 1, failed: 0, skipped: 0, 'expected failures': 0 });
  assert.equal(c['review-tablet-light']['expected failures'], 1);
  assert.equal(c['review-desktop-light'].failed, 1);
  assert.equal(c['review-phone-dark'].skipped, 1);
  assert.deepEqual(rows.map(recordingStatus), ['passed', 'expected-failure', 'failed', 'not recorded']);
  assert.equal(recordingStatus(undefined), 'not recorded');
  assert.equal(recordingStatus({ status: 'passed', expected: 'failed' }), 'failed');
});

test('each locked screen’s owner, as the brief’s table gives it', () => {
  const cases = {
    'desk-system-kit': 'P0-A',
    'page-phone-light': 'P0-C and P1-A',
    'narrow320-beranda': 'P0-C and P1-A',
    'phone-anggota-beranda-light': 'P1-A',
    'tablet-pengurus-kalender-dark': 'P1-A',
    'i-palette-phone': 'P1-A',
    'desk-anggota-pop-react-dark': 'P1-B',
    'desk-pengurus-pop-menu-own-light': 'P1-B',
    'i-desk-own-menu': 'P1-B',
    'phone-anggota-matkul-add-light': 'P1-C',
    'i-push-dialog': 'P1-C',
    'phone-anggota-ov-confirm-light': 'P1-C',
    'desk-anggota-ov-confirm-dark': 'P2-A',
    'i-form-review': 'P2-A',
    'phone-pengurus-form-empty-dark': 'P2-A',
    'phone-anggota-testi-course-light': 'P2-B',
    'i-testi-search': 'P2-B',
    'tablet-pengurus-curhat-empty-light': 'P2-C',
    'i-curhat-room': 'P2-C',
    'desk-pengurus-live-dark': 'P3-A',
    'i-desk-live': 'P3-A',
    'phone-pengurus-ov-addev-light': 'P3-B',
    'i-desk-kalender-after': 'P3-B',
  };
  for (const [name, owner] of Object.entries(cases)) assert.equal(ownerOfScreen(name), owner, name);
});

test('a different screen’s reason: a deviation that names it, else none', () => {
  const items = [
    { kind: 'deviation', text: 'i-desk-live’s locked capture shows the persona toast.', source: { file: 'reports/P3-A.md' } },
    { kind: 'needs-dev1', text: 'pengurus-beranda needs Dev 1.', source: { file: 'reports/P1-A.md' } },
  ];
  assert.match(deviationFor('i-desk-live', items), /persona toast.*P3-A\.md/);
  assert.equal(deviationFor('desk-pengurus-beranda-light', items), null);
});

test('the lab: medians per route, against SPEC’s budgets, with the probe’s answer', () => {
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([1, 2]), 1.5);
  assert.equal(median([]), null);
  const s = labSummary([
    { kind: 'probe', apiMs: 3, reaches: false },
    ...[1, 2, 3].map((run) => ({ kind: 'run', route: 'beranda', run, fcp: 1000 * run, lcp: 2000, cls: 0, tbt: 100, longestTask: 120, tapToPaint: 80, requestsBeforeContent: 16, kibBeforeContent: 300 })),
  ]);
  assert.equal(s.mockLatencyAdded, true);
  assert.equal(s.rows[0].fcp, 2000);
  assert.deepEqual(s.rows[0].overBudget, ['requests before content']);
  assert.equal(s.rows[0].today.lcp, 10500);
  assert.match(s.comparison, /indicative, not like for like/);
});

test('the release file is named for the package’s day', () => {
  assert.equal(releaseName('2026-10-20T08:00:00.000Z'), 'review-2026-10-20.zip');
});
