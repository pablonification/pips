/**
 * F2 (brief steps 5 and 12): the fixed rules on every page, as each person it differs for, at phone, tablet and
 * desktop in light and dark (the qa-<layout>-<theme> projects). On each page:
 * - the strict audit (axe, text ≥ 12 px, inputs 16 px on touch, `lang="id"`, no overflow): the sweep runs it too,
 *   but only in the review, so this keeps it in CI;
 * - landmarks: one `main`, one visible navigation named "Navigasi utama" in the shell, and one `h1` in the whole
 *   DOM (a second, hidden by CSS, is the duplicate SPEC's "one responsive tree" rules out: F1-5);
 * - type: Archivo Expanded only on page titles, the greeting, the wordmark and the member card's name; no
 *   monospace; no `text-transform` adding capitals; tabular figures on times, NIMs and course codes on their own;
 * - icons: no `<img>` icons, every inline SVG hidden from screen readers (or a named image), no colour written
 *   into an SVG instead of currentColor or a token;
 * - images: an `alt` that isn't a file name or a generic word (A14);
 * - the official logo: where SPEC puts it (the desktop sidebar at 54 px, the member card at 72 px), never under
 *   40 px, never stretched;
 * - a polite status region from the start (toasts and counts are announced into it);
 * - external links named "… situs luar, tab baru";
 * - the page's accessibility tree, saved as evidence with `QA_EVIDENCE=<folder>`.
 */
import { ROUTES } from '../review/routes';
import { layoutOf } from '../support/app';
import { expect, test } from '../support/test';
import { badAlt, isMonospace } from './lib';
import {
  audit,
  evidence,
  openSettled,
  QA_LAYOUT,
  screenFacts,
  slug,
} from './probe';

/** Pages without the shell: sign-in and first run have no navigation and no skip link. */
const NO_SHELL = new Set(['/login', '/mulai']);
/** Focused flows (src/lib/shell/routes.ts `focused`): no tab bar or rail on phones and tablets. */
const FOCUSED = new Set([
  '/pengumuman/tulis',
  '/layanan/curhat/$roomId',
  '/layanan/form/$formId',
  '/layanan/sparta',
  '/kelola/curhat/$roomId',
  '/mulai',
]);

for (const [path, route] of Object.entries(ROUTES))
  for (const who of route.as)
    test.describe(`${path} as ${who.key}`, () => {
      test.use(who.use);
      test(`the fixed rules on ${route.url} as ${who.key}`, async ({
        page,
        api,
      }, testInfo) => {
        test.skip(!QA_LAYOUT.test(testInfo.project.name), 'a qa layout');
        await openSettled(page, api, route.url);
        await audit(page, testInfo, `qa-${who.key}-${path}`);

        const f = await screenFacts(page);
        expect(f.lang).toBe('id');
        expect(f.mains, 'one main landmark').toBe(1);
        expect(
          f.h1InDom,
          'one h1 in the page, none hidden by CSS',
        ).toHaveLength(1);
        if (
          !NO_SHELL.has(path) &&
          !(FOCUSED.has(path) && layoutOf(testInfo) !== 'desktop')
        )
          expect(f.mainNavs, 'one visible "Navigasi utama"').toBe(1);
        expect(
          f.politeRegions,
          'a status region from the start',
        ).toBeGreaterThan(0);

        // Type
        expect(
          f.faces.filter((x) => !(x.face === 'Archivo Expanded' && x.allowed)),
          'Archivo Expanded only on titles, the greeting, the wordmark and the member card; Geist elsewhere',
        ).toEqual([]);
        expect(f.faces.filter((x) => isMonospace(x.family))).toEqual([]);
        expect(f.uppercase, 'no capitals added by CSS').toEqual([]);
        expect(
          f.notTabular,
          'tabular figures on times, NIMs and codes',
        ).toEqual([]);

        // Icons and images
        expect(
          f.svgNotHidden,
          'inline SVGs hidden from screen readers',
        ).toEqual([]);
        expect(
          f.svgHardColour,
          'SVG colours from currentColor or tokens',
        ).toEqual([]);
        const shown = f.imgs.filter((i) => !i.hidden);
        expect(
          shown.filter(
            (i) => /\.svg$/.test(i.src) && !i.src.startsWith('/__e2e__/'),
          ),
          'no <img> icons',
        ).toEqual([]);
        expect(
          shown.filter(
            (i) => i.alt === null || (i.alt !== '' && badAlt(i.alt)),
          ),
          'image alt text',
        ).toEqual([]);

        // The logo
        const logos = shown.filter((i) => i.src === '/logo/hmif.png');
        for (const l of logos) {
          expect(l.w, 'logo at least 40 px').toBeGreaterThanOrEqual(40);
          expect(
            Math.abs(l.w / l.h - 800 / 533),
            'logo unstretched',
          ).toBeLessThan(0.03);
          expect(l.natural, 'the official 800 px file').toBe(800);
        }
        // Behind a dialog (the composer on desktop) the page is hidden from screen readers, the logo too.
        const dialogOpen = await page.getByRole('dialog').count();
        if (
          layoutOf(testInfo) === 'desktop' &&
          !NO_SHELL.has(path) &&
          !dialogOpen
        )
          expect(logos.filter((l) => l.inSidebar).map((l) => l.w)).toEqual([
            54,
          ]);
        if (path === '/profil')
          expect(logos.filter((l) => l.onCard).map((l) => l.w)).toEqual([72]);
        if (path === '/login') expect(logos.length).toBeGreaterThan(0);

        // External links say they leave: "situs luar, tab baru" (SPEC story 67), "situs luar" on Beranda's tiles and
        // Pintasan (SPEC "Beranda", as the prototype's `tile`), "tab baru" on an event's Google Calendar (`evInfo`).
        // Not behind an open dialog: the page there is hidden from screen readers, so it has no names at all.
        const external = page.locator(
          'a[target="_blank"]:visible:not([aria-hidden="true"] *)',
        );
        for (let i = 0; i < (await external.count()); i++)
          await expect(external.nth(i)).toHaveAccessibleName(
            /\((situs luar, tab baru|situs luar|tab baru)\)$/,
          );

        evidence(
          testInfo,
          `aria/${who.key}-${slug(path)}.yml`,
          await page.locator('body').ariaSnapshot(),
        );
      });
    });
