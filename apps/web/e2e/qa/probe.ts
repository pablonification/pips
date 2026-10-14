/**
 * F2's page probes for e2e/qa: each reads raw facts in the page (computed styles, boxes, what is under a point) and
 * returns them, and the specs judge them in Node with lib.ts (so the rules are unit-tested, not copied into the page).
 */
import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '../support/test';
import { strictAudit } from '../support/strict';
import * as writes from '../support/writes';
import type { ApiMock } from '../support/mock';

/** A qa project of the six layouts and themes (`qa-phone-light` …). */
export const QA_LAYOUT = /^qa-(phone|tablet|desktop)-(light|dark)$/;

/** Opens a page as the sweep does (F1 `review/sweep.spec.ts`) and waits until nothing is loading. */
export async function openSettled(page: Page, api: ApiMock, url: string) {
  // Opening a post or a room marks it read.
  api.on('POST /api/info/:infoId/read', writes.markRead);
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  await page.goto(url);
  await expect(page.locator('main, [role="dialog"]').first()).toBeVisible();
  // Not "networkidle": Curhat and Live Counting keep a socket.io long poll open.
  await page.waitForLoadState('load');
  await expect(page.getByRole('status', { name: /^Memuat/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

/** Where evidence goes: `QA_EVIDENCE=<folder>` writes files there; without it nothing is written. */
export function evidence(testInfo: TestInfo, name: string, body: string) {
  const root = process.env.QA_EVIDENCE;
  if (!root) return;
  const file = path.join(root, testInfo.project.name, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

export const slug = (s: string) =>
  s
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-$/, '') || 'beranda';

export interface ScreenFacts {
  lang: string | null;
  h1InDom: string[];
  mains: number;
  mainNavs: number;
  /** Text whose first face isn't Geist, with where it is (judged in Node). */
  faces: { face: string; family: string; text: string; allowed: boolean }[];
  uppercase: string[];
  /** Inline SVGs that aren't hidden from screen readers and aren't a named image. */
  svgNotHidden: string[];
  /** Inline SVG shapes with a colour written into their attributes instead of currentColor or a token. */
  svgHardColour: string[];
  imgs: {
    src: string;
    alt: string | null;
    hidden: boolean;
    w: number;
    h: number;
    natural: number;
    inSidebar: boolean;
    onCard: boolean;
  }[];
  /** Times, NIMs and course codes without tabular figures. */
  notTabular: string[];
  politeRegions: number;
}

/** The fixed type, icon, landmark and image facts of the page as it is now. */
export function screenFacts(page: Page): Promise<ScreenFacts> {
  return page.evaluate(() => {
    const visible = (el: Element) =>
      (el as HTMLElement).checkVisibility?.({
        opacityProperty: true,
        visibilityProperty: true,
      }) ?? true;
    const ownText = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
    const where = (el: Element) => {
      const t = ownText(el) || el.getAttribute('aria-label') || '';
      return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}` : ''} "${t.slice(0, 40)}"`;
    };
    const faces: ScreenFacts['faces'] = [];
    const uppercase: string[] = [];
    const notTabular: string[] = [];
    const seenFace = new Set<string>();
    for (const el of document.body.querySelectorAll('*')) {
      const text = ownText(el);
      if (!text || !visible(el)) continue;
      const s = getComputedStyle(el);
      const face = s.fontFamily
        .split(',')[0]
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (face !== 'Geist') {
        const allowed = !!el.closest(
          'h1, .g-wordmark, .g-m-name, .g-d-head, .t-display-l, .t-display',
        );
        const key = `${face}|${allowed}|${text.slice(0, 20)}`;
        if (!seenFace.has(key)) {
          seenFace.add(key);
          faces.push({
            face,
            family: s.fontFamily,
            text: where(el),
            allowed:
              allowed && el.closest('h1, .g-wordmark, .g-m-name') !== null,
          });
        }
      }
      if (s.textTransform === 'uppercase' || s.textTransform === 'capitalize')
        uppercase.push(`${where(el)} (${s.textTransform})`);
      // A time (13.35, 09:00), a NIM (8 digits) or a course code (IF2110) on its own, as data (not a page title or a
      // breadcrumb, which never line up in a column).
      if (
        !el.closest('h1, nav') &&
        /^(\d{1,2}[.:]\d{2}|\d{8}|[A-Z]{2,4}\d{4})$/.test(text) &&
        !s.fontVariantNumeric.includes('tabular-nums')
      )
        notTabular.push(where(el));
    }
    const svgNotHidden: string[] = [];
    const svgHardColour: string[] = [];
    for (const svg of document.body.querySelectorAll('svg')) {
      if (!visible(svg)) continue;
      const hidden = svg.closest('[aria-hidden="true"]') !== null;
      const named =
        svg.getAttribute('role') === 'img' &&
        !!(
          svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby')
        );
      if (!hidden && !named) svgNotHidden.push(where(svg.parentElement ?? svg));
      for (const shape of [svg, ...svg.querySelectorAll('*')])
        for (const attr of ['fill', 'stroke', 'color']) {
          const v = shape.getAttribute(attr);
          if (v && /^(#|rgb|hsl)/i.test(v.trim())) {
            svgHardColour.push(
              `${where(svg.parentElement ?? svg)} ${shape.tagName}[${attr}=${v}]`,
            );
            break;
          }
        }
    }
    const imgs = [...document.querySelectorAll('img')].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        src: new URL(img.currentSrc || img.src, location.href).pathname,
        alt: img.getAttribute('alt'),
        hidden: !visible(img) || img.closest('[aria-hidden="true"]') !== null,
        w: Math.round(r.width),
        h: Math.round(r.height),
        natural: img.naturalWidth,
        inSidebar: img.closest('.g-side, aside, nav') !== null,
        onCard: img.closest('.g-m-card, .g-member, [class*="m-card"]') !== null,
      };
    });
    return {
      lang: document.documentElement.getAttribute('lang'),
      // A desk head below 1024 px that holds actions stays mounted, hidden, so an action's open dialog survives a
      // tablet turning (P3-B; C1 report, Needs Dev 1 item 4): its h1 isn't counted. Any other hidden h1 is.
      h1InDom: [...document.querySelectorAll('h1')]
        .filter(
          (h) =>
            visible(h) ||
            !(
              h.closest('.g-d-head') &&
              h.closest('.g-d-head')!.querySelector('button, a') &&
              !matchMedia('(min-width: 1024px)').matches
            ),
        )
        .map(
          (h) =>
            `${(h.textContent ?? '').trim().slice(0, 40)}${visible(h) ? '' : ' (hidden)'}`,
        ),
      mains: document.querySelectorAll('main, [role="main"]').length,
      mainNavs: [
        ...document.querySelectorAll('nav[aria-label="Navigasi utama"]'),
      ].filter(visible).length,
      faces,
      uppercase: [...new Set(uppercase)],
      svgNotHidden: [...new Set(svgNotHidden)],
      svgHardColour: [...new Set(svgHardColour)],
      imgs,
      notTabular: [...new Set(notTabular)],
      politeRegions: document.querySelectorAll(
        '[role="status"], [aria-live="polite"], [role="log"]',
      ).length,
    };
  });
}

/** One Tab stop, as the keyboard walk reads it. */
export interface Stop {
  id: string;
  name: string;
  skipLink: boolean;
  /** The ring: outline or box-shadow spread of 2 px or more, on the control, its ::after/::before or a wrapper. */
  ring: { width: number; colour: string; behind: string } | null;
  /** Points of the control covered by a fixed or sticky element that doesn't contain it. */
  coveredBy: string[];
  inDialog: boolean;
}

/** Reads the focused element: its name, its focus ring and what is behind it, and whether a fixed bar covers it. */
export function readStop(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement)
      return null;
    const text = (n: Element | null) =>
      (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const labelled = el
      .getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map((id) => text(document.getElementById(id)))
      .join(' ')
      .trim();
    const labels = (el as HTMLInputElement).labels
      ? [...((el as HTMLInputElement).labels ?? [])].map(text).join(' ')
      : '';
    const imgAlt = [...el.querySelectorAll('img[alt]')]
      .map((i) => i.getAttribute('alt'))
      .join(' ');
    const name = (
      el.getAttribute('aria-label') ||
      labelled ||
      labels ||
      text(el) ||
      imgAlt ||
      el.getAttribute('title') ||
      (el as HTMLInputElement).placeholder ||
      ''
    ).trim();

    // The ring, and the background it sits on: the nearest painted background outside the box that draws it.
    const ringOf = (node: Element, pseudo: string | null) => {
      const s = getComputedStyle(node, pseudo);
      if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1)
        return { width: parseFloat(s.outlineWidth), colour: s.outlineColor };
      if (s.boxShadow && s.boxShadow !== 'none') {
        // Layers: "rgb(…) 0px 0px 0px 4px, …"; the ring is the widest zero-offset, zero-blur, outer spread.
        let best: { width: number; colour: string } | null = null;
        for (const layer of s.boxShadow.split(/,(?![^(]*\))/)) {
          if (/inset/.test(layer)) continue;
          const colour = /(rgba?\([^)]*\)|color\([^)]*\))/.exec(layer)?.[1];
          const nums = layer
            .replace(/(rgba?\([^)]*\)|color\([^)]*\))/, '')
            .trim()
            .split(/\s+/)
            .map(parseFloat);
          const [x, y, blur, spread] = nums;
          if (colour && x === 0 && y === 0 && blur === 0 && spread >= 1)
            if (!best || spread > best.width) best = { width: spread, colour };
        }
        return best;
      }
      return null;
    };
    // A box-shadow ring has its own gap layer (`0 0 0 2px var(--bg-app)` under `0 0 0 4px var(--focus)`): the ring is
    // the outer 2 px, so its width is the difference and it sits on the page.
    // The control, what it holds (Beranda's tiles draw the ring on their keycap, as the prototype's `.tile-btn .key`),
    // and its three nearest wrappers (a field's box, a segmented control).
    const ringNodes: Element[] = [
      el,
      ...[...el.querySelectorAll('*')].slice(0, 20),
    ];
    for (let a = el.parentElement, n = 0; a && n < 3; a = a.parentElement, n++)
      ringNodes.push(a);
    let ring: Stop['ring'] = null;
    let drawnBy: Element | null = null;
    for (const node of ringNodes) {
      for (const pseudo of [null, '::after', '::before']) {
        const r = ringOf(node, pseudo);
        if (r && r.width >= 1) {
          ring = { ...r, behind: '' };
          drawnBy = node;
          break;
        }
      }
      if (ring) break;
    }
    if (ring && drawnBy) {
      const s = getComputedStyle(drawnBy);
      if (s.boxShadow !== 'none' && s.outlineStyle === 'none') {
        const spreads = s.boxShadow
          .split(/,(?![^(]*\))/)
          .filter((l) => !/inset/.test(l))
          .map((l) =>
            parseFloat(
              l
                .replace(/(rgba?\([^)]*\)|color\([^)]*\))/, '')
                .trim()
                .split(/\s+/)[3] ?? '0',
            ),
          )
          .sort((a, b) => b - a);
        if (spreads.length > 1) ring.width = spreads[0] - spreads[1];
      }
      // Behind the ring: the painted backgrounds from the drawing box's parent up, see-through ones listed too.
      const layers: string[] = [];
      for (let a = drawnBy.parentElement; a; a = a.parentElement) {
        const bg = getComputedStyle(a).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          layers.push(bg);
          if (!/rgba|\/ /.test(bg) || /, 1\)$/.test(bg)) break;
        }
      }
      layers.push(getComputedStyle(document.body).backgroundColor);
      ring.behind = layers.join(' | ');
    }

    // Five points inside the control (or the label that shows a visually hidden input).
    let box = el.getBoundingClientRect();
    if (
      (box.width < 4 || box.height < 4) &&
      (el as HTMLInputElement).labels?.[0]
    )
      box = (el as HTMLInputElement).labels![0].getBoundingClientRect();
    const coveredBy: string[] = [];
    const pts = [
      [0.5, 0.5],
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];
    for (const [fx, fy] of pts) {
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
      const lbl = (el as HTMLInputElement).labels;
      if (lbl && [...lbl].some((l) => l === hit || l.contains(hit))) continue;
      for (let a: Element | null = hit; a; a = a.parentElement) {
        const pos = getComputedStyle(a).position;
        if ((pos === 'fixed' || pos === 'sticky') && !a.contains(el)) {
          coveredBy.push(
            `${a.tagName.toLowerCase()}.${String(a.className).split(/\s+/)[0]}`,
          );
          break;
        }
      }
    }
    const role = el.getAttribute('role');
    return {
      id: `${el.tagName}${role ? `[${role}]` : ''}|${name.slice(0, 40)}|${Math.round(el.getBoundingClientRect().top + scrollY)}|${Math.round(el.getBoundingClientRect().left)}`,
      name,
      skipLink: el.matches('a[href="#isi"]'),
      ring,
      coveredBy: [...new Set(coveredBy)],
      inDialog: el.closest('[role="dialog"], [role="alertdialog"]') !== null,
    };
  });
}

/** The strict audit, under its own name in the qa projects. */
export const audit = (page: Page, testInfo: TestInfo, name: string) =>
  strictAudit(page, testInfo, name);
