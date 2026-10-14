/**
 * F2 (brief step 11), the copy check, by hand on the qa-copy-<layout> projects: the locked prototype's visible text
 * against the app's, screen by screen. Serve the locked `source/` folder (never copied into the repo), then:
 *   QA_PROTOTYPE_URL=http://127.0.0.1:4441/hmif-garis-prototype.html QA_COPY_OUT=<folder> \
 *     E2E_REUSE_BUILD=1 pnpm exec playwright test -c e2e --project=qa-copy-phone --project=qa-copy-tablet --project=qa-copy-desk
 * The prototype is put in each state with garis-check.mjs's `setView` (its ROUTES and PENGURUS_ROUTES below), the
 * app in the same state from fidelity/screens.ts. Both texts are normalised (lib.ts) and diffed line by line:
 * `#phone` for phone and tablet, `#desktop` for desktop; the prototype bar and its toast are outside those, and
 * "Contoh:" stand-ins are dropped. It records, it doesn't fail: every line is read by hand against the sample-data
 * differences in fixtures/NOTES.md and the owners' deviations (the F2 report lists what is left).
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import {
  PENGURUS_ROUTES as P_NAMES,
  ROUTES as A_NAMES,
  SIZES,
} from '../fidelity/names.mjs';
import { SCREENS } from '../fidelity/screens';
import { missingLines, textLines } from './lib';

const PROTO = process.env.QA_PROTOTYPE_URL;
const OUT = process.env.QA_COPY_OUT;
test.skip(
  !PROTO || !OUT,
  'Set QA_PROTOTYPE_URL and QA_COPY_OUT to run the copy check.',
);

type View = Record<string, unknown>;
// garis-check.mjs ROUTES and PENGURUS_ROUTES, as they are there.
const PROTO_A: [string, View][] = [
  ['beranda', { stack: ['beranda'] }],
  ['pengumuman', { stack: ['pengumuman'] }],
  [
    'post',
    {
      stack: ['pengumuman', ['post', { id: 'p1' }]],
      desk: ['pengumuman'],
      deskAnn: 'p1',
    },
  ],
  ['kalender', { stack: ['kalender'] }],
  ['layanan', { stack: ['layanan'] }],
  ['dingdong', { stack: ['layanan', 'dingdong'] }],
  [
    'testi-course',
    {
      stack: [
        'layanan',
        ['testi', { prog: 'IF', sem: 3, code: 'IF2110', i: 0 }],
      ],
    },
  ],
  ['testi-list', { stack: ['layanan', ['testi', { prog: 'IF', sem: 3 }]] }],
  ['nim', { stack: ['layanan', 'nim'] }],
  ['lomba', { stack: ['layanan', 'lomba'] }],
  ['curhat', { stack: ['layanan', 'curhat'] }],
  ['room', { stack: ['layanan', 'curhat', ['room', { id: 'r1' }]] }],
  ['form', { stack: ['layanan', 'form'] }],
  ['fill', { stack: ['layanan', 'form', ['fill', { id: 'pixel' }]] }],
  ['profil', { stack: ['profil'] }],
  ['matkul', { stack: ['profil', 'matkul'] }],
  ['matkul-add', { stack: ['profil', 'matkul', 'matkul-add'] }],
  ['notif', { stack: ['profil', 'notif'] }],
  [
    'tulis',
    {
      stack: ['pengumuman', 'tulis'],
      desk: ['pengumuman'],
      ov: { desk: { type: 'tulis' } },
    },
  ],
  [
    'ov-event',
    { stack: ['kalender'], ov: { phone: { type: 'event', id: 'a2' } } },
  ],
  [
    'ov-filter',
    {
      stack: ['pengumuman'],
      ov: { phone: { type: 'filter' }, desk: { type: 'filter' } },
    },
  ],
  [
    'ov-push',
    {
      stack: ['profil', 'notif'],
      ov: { phone: { type: 'push' }, desk: { type: 'push' } },
    },
  ],
  [
    'ov-confirm',
    {
      stack: ['profil'],
      ov: {
        phone: { type: 'confirm', kind: 'logout' },
        desk: { type: 'confirm', kind: 'send-form' },
      },
    },
  ],
  [
    'pop-react',
    {
      stack: ['pengumuman'],
      pop: {
        phone: { kind: 'react', id: 'p1' },
        desk: { kind: 'react', id: 'p1' },
      },
      deskAnn: 'p1',
    },
  ],
  [
    'pop-menu',
    {
      stack: ['pengumuman'],
      pop: {
        phone: { kind: 'menu', id: 'p2' },
        desk: { kind: 'menu', id: 'p1' },
      },
      deskAnn: 'p1',
    },
  ],
];
const PROTO_P: [string, View][] = [
  ['beranda', { stack: ['beranda'] }],
  ['pengumuman', { stack: ['pengumuman'] }],
  ['kalender', { stack: ['kalender'] }],
  ['layanan', { stack: ['layanan'] }],
  ['kelola', { stack: ['layanan', 'kelola'], desk: ['kelola'] }],
  ['live', { stack: ['layanan', 'kelola', 'live'], desk: ['kelola', 'live'] }],
  ['form-empty', { stack: ['layanan', 'form'] }],
  ['curhat-empty', { stack: ['layanan', 'curhat'] }],
  ['profil', { stack: ['profil'] }],
  [
    'ov-addev',
    {
      stack: ['kalender'],
      ov: { phone: { type: 'addev' }, desk: { type: 'addev' } },
    },
  ],
  [
    'pop-menu-own',
    {
      stack: ['pengumuman', ['post', { id: 'p1' }]],
      desk: ['pengumuman'],
      deskAnn: 'p5',
      pop: {
        phone: { kind: 'menu', id: 'p1' },
        desk: { kind: 'menu', id: 'p5' },
      },
    },
  ],
];

/** garis-check.mjs `setView`, as source: it runs inside the prototype's page. */
const SET_VIEW = `(v, who) => {
  if (S.who !== who) { switchPersona(who); document.getElementById('toast').classList.remove('show'); }
  for (const m of ['phone', 'desk']) {
    S[m].stack = (m === 'desk' && v.desk ? v.desk : v.stack).map((x) => (Array.isArray(x) ? { r: x[0], p: x[1] } : { r: x }));
    S.ov[m] = (v.ov && v.ov[m]) || null; S.pop[m] = (v.pop && v.pop[m]) || null;
  }
  if (v.deskAnn) S.deskAnn = v.deskAnn;
  renderAll();
}`;

const STAND_IN = /^Contoh:|\(contoh\)|^Prototipe/;

for (const [persona, names, views] of [
  ['anggota', A_NAMES, PROTO_A],
  ['pengurus', P_NAMES, PROTO_P],
] as const)
  for (const route of names) {
    const entry = SCREENS[`${persona}-${route}`];
    const view = views.find(([r]) => r === route)?.[1];
    if (!entry || !view) continue;
    const entries = Array.isArray(entry) ? entry : [entry];
    test.describe(`${persona}-${route}`, () => {
      test.use({ persona, platform: 'Linux x86_64' });
      test(`copy: ${persona}-${route}`, async ({
        page,
        api,
        context,
        browser,
      }, testInfo) => {
        const layout = /^qa-copy-(phone|tablet|desk)$/.exec(
          testInfo.project.name,
        )?.[1] as 'phone' | 'tablet' | 'desk' | undefined;
        test.skip(!layout, 'a qa-copy project');
        const screen = entries.find(
          (e) => !e.layouts || e.layouts.includes(layout!),
        );
        if (!screen) return;

        // The app, as the fidelity capture puts it.
        screen.mock?.(api);
        await page.goto(screen.paths?.[layout!] ?? screen.path);
        await screen.act?.(page, { api, context });
        await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(300);
        const app = await page.evaluate(() => document.body.innerText);

        // The prototype, in its own context (the harness's mock blocks other origins).
        const size = SIZES[layout!];
        const ctx = await browser.newContext({
          viewport: { width: size.width, height: size.height + 40 },
          deviceScaleFactor: size.deviceScaleFactor,
          isMobile: layout !== 'desk',
          hasTouch: layout !== 'desk',
          colorScheme: 'light',
        });
        const proto = await ctx.newPage();
        await proto.goto(
          `${PROTO}${layout === 'phone' ? '?app' : layout === 'tablet' ? '?tablet' : ''}`,
        );
        await proto.evaluate(() => document.fonts.ready);
        // The prototype's state lives in its script's own globals (`S`, `switchPersona`, `renderAll`), which aren't
        // properties of window, so garis-check.mjs's setView runs as source text.
        await proto.evaluate(
          `(${SET_VIEW})(${JSON.stringify(view)}, ${JSON.stringify(persona)})`,
        );
        await proto.waitForTimeout(300);
        const protoText = await proto.evaluate(
          (sel) =>
            (document.querySelector(sel) as HTMLElement | null)?.innerText ??
            '',
          layout === 'desk' ? '#desktop' : '#phone',
        );
        await ctx.close();

        const a = textLines(app);
        const p = textLines(protoText).filter((l) => !STAND_IN.test(l));
        const result = {
          screen: `${layout}-${persona}-${route}`,
          onlyInPrototype: missingLines(p, a),
          onlyInApp: missingLines(a, p),
        };
        fs.mkdirSync(OUT!, { recursive: true });
        fs.writeFileSync(
          path.join(OUT!, `${result.screen}.json`),
          JSON.stringify(result, null, 2),
        );
      });
    });
  }
