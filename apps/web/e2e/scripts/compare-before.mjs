// `pnpm --filter web e2e:compare-before`: proves a change left the interface unchanged (T4 and later
// infrastructure work).
//
// Re-captures every state of the before set, then compares each pair pixel by pixel (pixelmatch, colour
// tolerance 0.1, anti-aliasing ignored). Writes report.json, side-by-side images (before | after | diff) and an
// index.html summary to ops/redesign/compare/<timestamp>/.
//
// A state counts as changed when more than E2E_COMPARE_THRESHOLD of its pixels differ (default 0.0001 = 0.01 %),
// or when it is missing on either side. A state the redesigned app no longer has (states.ts `removed`, such as the
// install tutorial) is captured at its path and listed as removed, with its reason. The command exits 1 if any
// state changed or is missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FILTER_SCRIPT, filterSelect, page } from './lib/html.mjs';
import {
  COMPARE_THRESHOLD,
  pixelDiff,
  readPng,
  sideBySide,
  writePng,
} from './lib/image.mjs';
import { captureStatus } from './lib/compare.mjs';
import { recordDir, stamp } from './lib/paths.mjs';
import {
  CAPTURE_PROJECTS,
  VARIANTS,
  esc,
  gitHead,
  playwright,
  readRecords,
} from './lib/run.mjs';

const threshold = Number(
  process.env.E2E_COMPARE_THRESHOLD ?? COMPARE_THRESHOLD,
);
const beforeDir = recordDir('before-set');
const manifestFile = path.join(beforeDir, 'manifest.json');
if (!existsSync(manifestFile)) {
  console.error(
    `No before set at ${beforeDir}. Record it first with e2e:before.`,
  );
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const out = recordDir(path.join('compare', stamp()));
const afterDir = path.join(out, 'after');
mkdirSync(afterDir, { recursive: true });

const code = playwright(CAPTURE_PROJECTS, {
  E2E_CAPTURE_DIR: afterDir,
  E2E_GATES: 'record',
});
const after = new Map(
  readRecords(afterDir).map((r) => [`${r.variant}/${r.id}`, r]),
);

/** @type {any[]} */
const rows = [];
for (const state of manifest.states) {
  for (const variant of VARIANTS) {
    const b = state.variants[variant];
    if (!b) continue;
    const a = after.get(`${variant}/${state.id}`);
    const row = {
      id: state.id,
      title: state.title,
      persona: state.persona,
      variant,
      before: path.relative(out, path.join(beforeDir, b.image)),
      axeBefore: b.axe,
    };
    if (!a) {
      rows.push({
        ...row,
        status: captureStatus({ captured: false, threshold }),
        ratio: 1,
      });
      continue;
    }
    const removed = a.removed ? { note: `removed: ${a.removed}` } : {};
    const imgB = readPng(path.join(beforeDir, b.image));
    const imgA = readPng(path.join(afterDir, a.image));
    const afterRel = path.relative(out, path.join(afterDir, a.image));
    const axeAfter = { total: a.audit.axe.total, ...a.audit.axe.byImpact };
    if (imgB.width !== imgA.width || imgB.height !== imgA.height) {
      rows.push({
        ...row,
        after: afterRel,
        axeAfter,
        status: captureStatus({
          captured: true,
          removed: a.removed,
          sizeDiffers: true,
          threshold,
        }),
        ratio: 1,
        note: `size ${imgB.width}×${imgB.height} → ${imgA.width}×${imgA.height}`,
        ...removed,
      });
      continue;
    }
    const d = pixelDiff(imgB, imgA);
    const sbs = path.join('side-by-side', variant, `${state.id}.png`);
    mkdirSync(path.join(out, 'side-by-side', variant), { recursive: true });
    writePng(path.join(out, sbs), sideBySide([imgB, imgA, d.diff]));
    rows.push({
      ...row,
      after: afterRel,
      sideBySide: sbs,
      axeAfter,
      changedPixels: d.changed,
      ratio: d.ratio,
      status: captureStatus({
        captured: true,
        removed: a.removed,
        ratio: d.ratio,
        threshold,
      }),
      ...removed,
    });
  }
}
// States captured now that the before set doesn't have are reported, not failed: they are new.
const known = new Set(
  manifest.states.flatMap((/** @type {any} */ s) =>
    Object.keys(s.variants).map((v) => `${v}/${s.id}`),
  ),
);
const added = [...after.keys()].filter((k) => !known.has(k));

const changed = rows.filter(
  (r) => r.status !== 'unchanged' && r.status !== 'removed',
);
const report = {
  kind: 'pips-compare-before',
  comparedAt: new Date().toISOString(),
  app: `apps/web at ${gitHead()}`,
  beforeSet: {
    dir: beforeDir,
    recordedAt: manifest.recordedAt,
    app: manifest.app,
  },
  threshold: { changedPixelRatio: threshold, pixelmatchColourTolerance: 0.1 },
  summary: {
    compared: rows.length,
    unchanged: rows.length - changed.length,
    changed: changed.filter((r) => r.status === 'changed').length,
    missing: changed.filter((r) => r.status === 'missing').length,
    removed: rows.filter((r) => r.status === 'removed').length,
    newStates: added.length,
  },
  captureExitCode: code,
  states: rows,
  newStates: added,
};
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(out, 'index.html'), html(report));

const s = report.summary;
console.log(
  `\nCompared ${s.compared} captures with the before set: ${s.unchanged} unchanged, ${s.changed} changed, ${s.missing} missing, ${s.removed} removed, ${s.newStates} new.`,
);
for (const r of changed)
  console.log(
    `  ${r.status.padEnd(8)} ${r.variant}/${r.id}  ${(r.ratio * 100).toFixed(3)} %${r.note ? `  ${r.note}` : ''}`,
  );
console.log(`Report: ${path.join(out, 'index.html')}`);
process.exit(changed.length || code !== 0 ? 1 : 0);

/** @param {any} r */
function html(r) {
  /** @param {number} x */
  const pct = (x) => `${(x * 100).toFixed(3)} %`;
  /** @param {any} x */
  const axe = (x) =>
    x ? `${x.critical}/${x.serious}/${x.moderate}/${x.minor}` : '–';
  const sorted = [...r.states].sort((a, b) => b.ratio - a.ratio);
  const cards = sorted
    .map(
      (
        row,
      ) => `<div class="card" data-card data-status="${row.status}" data-variant="${row.variant}">
  <h3>${esc(row.title)} <span class="muted">· ${row.variant}</span> <span class="tag ${row.status === 'unchanged' ? 'ok' : 'bad'}">${row.status} · ${pct(row.ratio)}</span></h3>
  ${row.sideBySide ? `<a href="${esc(row.sideBySide)}"><img loading="lazy" src="${esc(row.sideBySide)}" alt="${esc(`${row.title} ${row.variant}: before, after, difference`)}"></a><p class="muted">before · after · changed pixels in red</p>` : `<p>${esc(row.note ?? 'no capture after the change')}</p>`}
  <p><span class="tag">axe before ${axe(row.axeBefore)}</span><span class="tag">axe after ${axe(row.axeAfter)}</span><span class="muted">(critical/serious/moderate/minor)</span></p>
</div>`,
    )
    .join('\n');
  const s = r.summary;
  const body = `<h1>Compared with the before set</h1>
<p>${esc(r.app)}, ${esc(r.comparedAt)}. Before set: ${esc(r.beforeSet.app)}, recorded ${esc(r.beforeSet.recordedAt)}.</p>
<p><strong>${s.compared} captures: ${s.unchanged} unchanged, ${s.changed} changed, ${s.missing} missing, ${s.removed} removed</strong>${s.newStates ? `, ${s.newStates} new (${esc(r.newStates.join(', '))})` : ''}.
A capture counts as changed above ${pct(r.threshold.changedPixelRatio)} changed pixels (pixelmatch colour tolerance ${r.threshold.pixelmatchColourTolerance}).</p>
<div class="filters">${filterSelect('status', 'Status', ['changed', 'missing', 'removed', 'unchanged'])}${filterSelect('variant', 'Size and theme', VARIANTS)}<span class="muted"><span id="count"></span> shown</span></div>
<div class="wide"><div class="grid">${cards}</div></div>`;
  return page('PIPS! compared with the before set', body, FILTER_SCRIPT);
}
