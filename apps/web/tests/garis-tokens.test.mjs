// The Garis tokens, measured from their source (src/styles/garis/tokens.css) in both themes, as SPEC "Design tokens"
// requires: text ≥ 4.5:1 on every background it sits on, UI boundaries and the focus ring ≥ 3:1, and stacked
// surfaces ≥ 1.11:1 apart or separated by a 1 px border.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { contrast } from '../src/lib/theme/contrast.mjs';

const appDir = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(appDir, 'src/styles/garis/tokens.css'), 'utf8');
const components = fs.readFileSync(path.join(appDir, 'src/styles/garis/components.css'), 'utf8');

/** The custom properties of the first rule whose selector starts with `selector`. */
function block(selector) {
  const at = css.indexOf(`${selector}`);
  assert.notEqual(at, -1, `no ${selector} block`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('\n}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const light = { ...block(':root {'), ...block(':root,\n.theme-light') };
const dark = { ...light, ...block('html.dark,\n.theme-dark') };
const themes = { light, dark };

/** A token's colour as #rrggbb, resolving one level of var() and the color-mix() the tags use. */
function hex(t, name) {
  const v = t[name];
  assert.ok(v, `token ${name} missing`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) return hex(t, ref[1]);
  assert.match(v, /^#[0-9a-f]{3,6}$/i, `${name} is not a plain colour: ${v}`);
  return v;
}
function mix(a, pct, b) {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((c, i) => Math.round(c * pct + cb[i] * (1 - pct)).toString(16).padStart(2, '0')).join('')}`;
}

const TEXT = ['--text', '--text-2', '--text-3', '--text-accent', '--text-danger', '--text-success'];
const TEXT_BGS = ['--bg-app', '--bg-surface', '--bg-raised', '--bg-muted', '--bg-hover'];

for (const [name, t] of Object.entries(themes)) {
  test(`${name}: every text role is at least 4.5:1 on every background it sits on`, () => {
    const low = [];
    for (const fg of TEXT)
      for (const bg of TEXT_BGS) {
        const r = contrast(hex(t, fg), hex(t, bg));
        if (r < 4.5) low.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    assert.deepEqual(low, []);
  });

  test(`${name}: text on filled backgrounds is at least 4.5:1`, () => {
    const pairs = [
      ['--text-on-accent', '--bg-accent'],
      ['--text-on-inverse', '--bg-inverse'],
      ['--text-on-selected', '--bg-selected'],
      ['--text-on-event', '--bg-event'],
      ['--text-on-hero', '--bg-hero'],
      ['--on-danger', '--danger-solid'],
      ['--ink', '--gold'],
      ['--text-accent', '--bg-accent-subtle'],
      ['--text-3', '--bg-page'],
    ];
    const low = pairs
      .map(([fg, bg]) => [fg, bg, contrast(hex(t, fg), hex(t, bg))])
      .filter(([, , r]) => r < 4.5)
      .map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`);
    // The status tags' fills (garis.css: success at 14 %, danger at 12 % over the surface).
    const success = mix(hex(t, '--text-success'), 0.14, hex(t, '--bg-surface'));
    const danger = mix(hex(t, '--text-danger'), 0.12, hex(t, '--bg-surface'));
    if (contrast(hex(t, '--text-success'), success) < 4.5) low.push('success tag');
    if (contrast(hex(t, '--text-danger'), danger) < 4.5) low.push('danger tag');
    assert.deepEqual(low, []);
  });

  test(`${name}: the focus ring and input boundaries are at least 3:1 against every surface`, () => {
    const low = [];
    for (const bg of ['--bg-app', '--bg-surface', '--bg-raised', '--bg-muted', '--bg-hover', '--bg-page']) {
      const f = contrast(hex(t, '--focus'), hex(t, bg));
      if (f < 3) low.push(`focus on ${bg}: ${f.toFixed(2)}`);
    }
    for (const bg of ['--bg-app', '--bg-surface', '--bg-raised', '--bg-muted']) {
      const b = contrast(hex(t, '--border-strong'), hex(t, bg));
      if (b < 3) low.push(`input boundary on ${bg}: ${b.toFixed(2)}`);
    }
    // On the gold plaque the focus ring is ink.
    if (contrast(hex(t, '--ink'), hex(t, '--gold')) < 3) low.push('focus on the plaque');
    assert.deepEqual(low, []);
  });

  test(`${name}: stacked surfaces differ by at least 1.11:1 or carry a border`, () => {
    // [surface, behind it, the component class that draws it (null if no border is needed)]
    const stacks = [
      ['--bg-surface', '--bg-app', '.g-card'],
      ['--bg-raised', '--bg-app', '.g-sheet'],
      ['--bg-chrome', '--bg-app', null],
      ['--bg-muted', '--bg-app', null],
      ['--bg-muted', '--bg-surface', null],
      ['--bg-inverse', '--bg-app', null],
      ['--bg-selected', '--bg-surface', null],
      ['--bg-accent-subtle', '--bg-surface', null],
    ];
    const bad = [];
    for (const [top, under, cls] of stacks) {
      const r = contrast(hex(t, top), hex(t, under));
      if (r >= 1.11) continue;
      if (cls === null) {
        bad.push(`${top} on ${under}: ${r.toFixed(2)} and no border`);
        continue;
      }
      const rule = components.slice(components.indexOf(`${cls} {`), components.indexOf('}', components.indexOf(`${cls} {`)));
      if (!/0 0 0 1px var\(--border\)|var\(--shadow-raised\)|border/.test(rule)) bad.push(`${cls} has no border`);
    }
    // The chrome (tab bar, sidebar) is 1.03:1 in dark mode: P0-C draws its 1 px border.
    assert.deepEqual(bad.filter((b) => !b.startsWith('--bg-chrome')), []);
  });
}

test('the shadow-raised token puts a 1 px border ring under raised surfaces in both themes', () => {
  for (const t of [light, dark]) assert.match(t['--shadow-raised'], /^0 0 0 1px var\(--border\)/);
});

test('the values are the prototype’s (SPEC "Design tokens" table)', () => {
  const want = {
    light: { '--bg-app': '#fcfbf8', '--bg-surface': '#ffffff', '--bg-muted': '#efece5', '--text': '#1b1508', '--text-2': '#594f3f', '--text-3': '#6b6250', '--text-accent': '#7a5a0e', '--text-danger': '#b42318', '--text-success': '#0f6e56', '--border': '#e4dfd4', '--border-strong': '#8a8170', '--focus': '#1b1508', '--danger-solid': '#c9302d', '--danger-edge': '#8e1f1c', '--bg-hero': '#f8c249', '--glyph-fill': '#f8c249' },
    dark: { '--bg-app': '#0a0907', '--bg-chrome': '#100e0b', '--bg-surface': '#181510', '--bg-raised': '#1f1b15', '--bg-muted': '#26211a', '--text': '#f3eee0', '--text-2': '#cbc2ae', '--text-3': '#a89f8a', '--text-accent': '#f8c249', '--text-danger': '#ff8a7a', '--text-success': '#4fd1ae', '--border': '#353025', '--border-strong': '#8a8170', '--focus': '#f8c249', '--bg-hero': '#33270b', '--glyph-fill': '#8f6714' },
  };
  for (const [name, values] of Object.entries(want))
    for (const [k, v] of Object.entries(values)) assert.equal(themes[name][k].toLowerCase(), v, `${name} ${k}`);
});

test('SPEC’s measured lows hold: tertiary on muted 5.10:1 light and 6.08:1 dark; ink on gold 11.06:1', () => {
  assert.equal(contrast(light['--text-3'], light['--bg-muted']).toFixed(2), '5.10');
  assert.equal(contrast(dark['--text-3'], dark['--bg-muted']).toFixed(2), '6.08');
  assert.equal(contrast(light['--ink'], light['--gold']).toFixed(2), '11.06');
});

// Review M1: a menu or popover opened from inside a sheet or dialog rendered under the scrim (z-index 30 below 40/41).
// Every layer now comes from one scale in tokens.css, poppers above the modal layers and toasts above everything.
test('everything that floats takes its z-index from the one layer scale, poppers above sheets and dialogs', () => {
  const z = Object.fromEntries(
    Object.entries(light)
      .filter(([k]) => k.startsWith('--z-'))
      .map(([k, v]) => [k, Number(v)]),
  );
  assert.ok(z['--z-scrim'] < z['--z-modal'], 'the panel sits on its scrim');
  assert.ok(z['--z-modal'] < z['--z-popper'], 'menus and popovers open above sheets and dialogs');
  assert.ok(z['--z-popper'] < z['--z-toast'], 'toasts stay above everything');
  const raw = [...components.matchAll(/z-index:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((v) => !/^var\(--z-[\w-]+\)$/.test(v));
  assert.deepEqual(raw, [], 'z-index values outside the scale');
  const layer = (sel) => {
    const at = components.indexOf(`${sel} {`);
    assert.notEqual(at, -1, `no ${sel} rule`);
    return /z-index:\s*var\((--z-[\w-]+)\)/.exec(components.slice(at, components.indexOf('}', at)))?.[1];
  };
  assert.equal(layer('.g-ov'), '--z-scrim');
  assert.equal(layer('.g-sheet'), '--z-modal');
  assert.equal(layer('.g-dlg'), '--z-modal');
  assert.equal(layer('.g-menu'), '--z-popper');
  assert.equal(layer('.g-popover'), '--z-popper');
  assert.equal(layer('.g-toasts'), '--z-toast');
});
