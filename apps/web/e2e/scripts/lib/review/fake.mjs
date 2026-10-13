// A small fake review package for testing the index (tests/review-index.test.mjs, e2e/review/package.spec.ts):
// two flows, each with a 2-second placeholder clip ffmpeg makes from a still, a poster, one fidelity pair, one
// before-and-after pair, one still and the data files. Nothing in it comes from a real recording.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { CSS, JS, buildIndex } from './index.mjs';
import { TOOLS, mp4Args, run, webpArgs } from './media.mjs';

/** A solid-colour PNG. @param {string} file @param {number} w @param {number} h @param {[number, number, number]} rgb */
export function solidPng(file, w, h, rgb) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([...rgb, 255], i);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

/** The data a fake package shows. */
export function fakeData() {
  const steps = [
    { title: 'Beranda opens', at: 0 },
    { title: 'Sabtu shows Bakti Sosial HMIF', at: 1.2 },
  ];
  const rec = (/** @type {string} */ id, /** @type {string} */ status) => ({
    layout: 'phone',
    theme: 'light',
    variant: 'nadia',
    who: 'Nadia',
    name: 'phone-light',
    file: `media/flows/${id}/phone-light.mp4`,
    poster: `media/flows/${id}/phone-light.webp`,
    status,
    steps,
    guard: { answered: 12, blocked: 0, unhandled: 0, writes: 0 },
    gates: [{ name: 'beranda', failures: [] }],
  });
  return {
    release: 'review-2026-10-14.zip',
    createdAt: '2026-10-14 09:00',
    commit: 'abc1234',
    areas: [{ id: 'beranda', title: 'Beranda' }],
    findings: [
      { id: 'F1-1', title: 'A <fake> finding & more', flows: ['search'] },
    ],
    flows: {
      flows: [
        {
          id: 'beranda',
          title: 'Beranda',
          area: 'beranda',
          variants: [{ key: 'nadia', who: 'Nadia' }],
          stories: [26],
          owners: ['P1-A'],
          startsAt: '/',
          check: 'The agenda card <b>on today</b>.',
          locked: ['anggota-beranda'],
          recordings: [rec('beranda', 'passed')],
          beforeAfter: ['home'],
          questions: ['D5: <script>x</script>'],
        },
        {
          id: 'search',
          title: 'Global search',
          area: 'beranda',
          variants: [{ key: 'nadia', who: 'Nadia' }],
          stories: [22],
          owners: ['P1-A'],
          startsAt: '/',
          check: 'Search.',
          locked: [],
          knownFailure: 'F1-1: fake',
          recordings: [rec('search', 'expected-failure')],
          beforeAfter: [],
          questions: [],
        },
      ],
    },
    fidelity: {
      summary: { close: 1, different: 0, notBuiltYet: 0, prototypeOnly: 1 },
      screens: [
        {
          name: 'phone-anggota-beranda-light',
          layout: 'phone',
          theme: 'light',
          persona: 'anggota',
          owner: 'P1-A',
          status: 'close',
          ssim: 0.97,
          changed: 0.01,
          sideBySide: 'media/fidelity/phone-anggota-beranda-light.webp',
        },
        {
          name: 'desk-pengurus-live-dark',
          layout: 'desk',
          theme: 'dark',
          persona: 'pengurus',
          owner: 'P3-A',
          status: 'different',
          ssim: 0.9,
          changed: 0.1,
          sideBySide: 'media/fidelity/desk-pengurus-live-dark.webp',
          deviation: 'The live square blinks.',
        },
        {
          name: 'proto-panel-phone',
          layout: '',
          theme: '',
          persona: 'none',
          owner: '–',
          status: 'prototype only',
        },
      ],
    },
    beforeAfter: {
      totals: {
        before: { critical: 104, serious: 178, captures: 200 },
        after: { critical: 0, serious: 0, captures: 1 },
      },
      pairs: [
        {
          id: 'home',
          title: 'Home',
          variant: 'phone-light',
          status: 'paired',
          image: 'media/before-after/phone-light/home.webp',
          before: {
            axe: { critical: 2, serious: 3 },
            overflowX: 0,
            smallText: 4,
            minPx: 10,
            lang: 'en',
          },
          after: {
            axe: { critical: 0, serious: 0 },
            overflowX: 0,
            smallText: 0,
            minPx: null,
            lang: 'id',
          },
        },
      ],
    },
    stills: {
      stills: [
        {
          id: 'p1-c-masuk',
          title: 'Masuk',
          owner: 'P1-C',
          source: 'reports/P1-C',
          images: [
            {
              layout: 'phone',
              theme: 'light',
              file: 'media/stills/p1-c-masuk/phone-light.webp',
            },
          ],
        },
      ],
      appIcons: [
        {
          file: 'media/stills/app-icons/android-chrome-192x192.png',
          title: 'App icon',
        },
      ],
      oldFiles: ['splash.png'],
    },
    checks: {
      checks: [
        {
          id: 'repo-check',
          title: 'pnpm check',
          status: 'green',
          command: 'pnpm check',
          date: '2026-10-14',
        },
        { id: 'staging', title: 'Staging', status: 'slot', note: 'Dev 1' },
      ],
    },
    questions: {
      total: 2,
      groups: [
        {
          who: 'the owner',
          items: [
            {
              id: 'D1',
              kind: 'open-question',
              question: 'Kelola on phones?',
              status: 'open',
              built: 'The prototype',
              tags: [],
              sources: [{ file: 'OPEN-QUESTIONS.md', line: 7 }],
            },
            {
              id: null,
              kind: 'new-copy',
              question: '"Langsung ke isi halaman"',
              status: 'open',
              tags: [],
              sources: [{ file: 'reports/P0-C-shell.md', line: 239 }],
            },
          ],
        },
        { who: 'HMIF', items: [] },
        { who: 'HMIF Welfare', items: [] },
        {
          who: 'Dev 1',
          items: [
            {
              id: 'C3',
              kind: 'found',
              question: 'Curhat privacy hole',
              status: 'found',
              tags: ['security'],
              sources: [{ file: 'OPEN-QUESTIONS.md', line: 40 }],
            },
          ],
        },
      ],
    },
    coverage: [
      { story: 22, status: 'shown', flows: ['search'], checks: [] },
      { story: 26, status: 'shown', flows: ['beranda'], checks: [] },
      {
        story: 35,
        status: 'not built',
        flows: [],
        checks: [],
        reason: 'No design',
      },
    ],
    sizes: {
      budget: 300 * 1024 * 1024,
      parts: [
        { id: 'recordings-light', title: 'Recordings in light', bytes: 1000 },
      ],
    },
  };
}

/**
 * Writes the fake package into `dir`: index, assets, data and (with `media`) the media folder.
 * @param {string} dir @param {{ media?: boolean }} [o]
 */
export function writeFakePackage(dir, { media = true } = {}) {
  rmSync(dir, { recursive: true, force: true });
  const d = fakeData();
  mkdirSync(path.join(dir, 'assets'), { recursive: true });
  mkdirSync(path.join(dir, 'data'), { recursive: true });
  writeFileSync(path.join(dir, 'assets', 'review.css'), CSS);
  writeFileSync(path.join(dir, 'assets', 'review.js'), JS);
  writeFileSync(path.join(dir, '.gitignore'), 'media/\n');
  for (const [k, v] of Object.entries(d))
    if (typeof v === 'object')
      writeFileSync(path.join(dir, 'data', `${k}.json`), JSON.stringify(v));
  writeFileSync(path.join(dir, 'index.html'), buildIndex(d));
  if (!media) return d;
  const tmp = path.join(dir, '.tmp');
  const still = path.join(tmp, 'still.png');
  solidPng(still, 390, 844, [252, 251, 248]);
  for (const f of d.flows.flows)
    for (const r of f.recordings) {
      const mp4 = path.join(dir, r.file);
      mkdirSync(path.dirname(mp4), { recursive: true });
      // A 2-second clip from the still: ffmpeg loops the image (-loop 1 -t 2) before the usual conversion.
      run(TOOLS.ffmpeg, [
        '-loop',
        '1',
        '-t',
        '2',
        ...mp4Args(still, mp4).slice(3),
      ]);
      run(
        TOOLS.cwebp,
        webpArgs(still, path.join(dir, r.poster), { width: 180 }),
      );
    }
  for (const file of /** @type {string[]} */ ([
    ...d.fidelity.screens.map((s) => s.sideBySide).filter(Boolean),
    ...d.beforeAfter.pairs.map((p) => p.image),
    ...d.stills.stills.flatMap((s) => s.images.map((i) => i.file)),
    'media/present.webp',
  ])) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    run(TOOLS.cwebp, webpArgs(still, path.join(dir, file), { width: 120 }));
  }
  for (const i of d.stills.appIcons) {
    mkdirSync(path.dirname(path.join(dir, i.file)), { recursive: true });
    solidPng(path.join(dir, i.file), 64, 64, [27, 21, 8]);
  }
  rmSync(tmp, { recursive: true, force: true });
  return d;
}
