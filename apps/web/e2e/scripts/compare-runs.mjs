// `pnpm --filter web fidelity:compare <baseline> <final>`: proves two fidelity runs captured the same app (C1).
//
// Takes two folders written by `pnpm --filter web fidelity` (ops/redesign/fidelity/<run>/, each with report.json
// and app/*.png) and compares every screen: its status in each run ("close", "different", "not built yet") and
// its app capture, pixel by pixel at compare-before's threshold (COMPARE_THRESHOLD, colour tolerance 0.1,
// anti-aliasing ignored). Writes report.json, index.html and side-by-side images (baseline | final | diff) for the
// changed screens to ops/redesign/compare/runs-<timestamp>/. Exits 1 if any screen changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { page } from './lib/html.mjs';
import {
  COMPARE_THRESHOLD,
  pixelDiff,
  readPng,
  sideBySide,
  writePng,
} from './lib/image.mjs';
import { recordDir, stamp } from './lib/paths.mjs';
import { esc } from './lib/run.mjs';

/** @typedef {import('./lib/image.mjs').Img} Img */
/** @typedef {{ name: string; status: string; app?: string }} Screen */
/** @typedef {{ screens: Screen[] }} Run */
/**
 * @typedef {{ name: string; status: string; note?: string; statusBefore?: string; statusAfter?: string;
 *   changedPixels?: number; ratio?: number; images?: Img[]; sideBySide?: string }} Row
 */

/**
 * Compares two runs. `load(run, file)` reads a capture as an image, or returns null when the file is missing.
 * Returns one row per screen in either run: `unchanged`, `changed` (pixels, size or status) or `missing`.
 */
/**
 * @param {Run} baseline @param {Run} final
 * @param {(run: 'baseline' | 'final', file: string) => Img | null} load
 * @returns {Row[]}
 */
export function compareRuns(
  baseline,
  final,
  load,
  threshold = COMPARE_THRESHOLD,
) {
  const byName = (/** @type {Run} */ r) => new Map(r.screens.map((s) => [s.name, s]));
  const a = byName(baseline);
  const b = byName(final);
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  return names.map((name) => {
    const before = a.get(name);
    const after = b.get(name);
    if (!before || !after)
      return {
        name,
        status: 'missing',
        note: before ? 'not in the final run' : 'not in the baseline run',
      };
    const row = {
      name,
      statusBefore: before.status,
      statusAfter: after.status,
    };
    if (before.status !== after.status)
      return {
        ...row,
        status: 'changed',
        note: `${before.status} → ${after.status}`,
      };
    // Screens neither run captured ("not built yet", prototype-only) have nothing more to compare.
    if (!before.app && !after.app) return { ...row, status: 'unchanged' };
    const imgA = before.app ? load('baseline', before.app) : null;
    const imgB = after.app ? load('final', after.app) : null;
    if (!imgA || !imgB)
      return {
        ...row,
        status: 'missing',
        note: imgA ? 'no final capture' : 'no baseline capture',
      };
    if (imgA.width !== imgB.width || imgA.height !== imgB.height)
      return {
        ...row,
        status: 'changed',
        note: `size ${imgA.width}×${imgA.height} → ${imgB.width}×${imgB.height}`,
      };
    const d = pixelDiff(imgA, imgB);
    return {
      ...row,
      status: d.ratio > threshold ? 'changed' : 'unchanged',
      changedPixels: d.changed,
      ratio: d.ratio,
      images: [imgA, imgB, d.diff],
    };
  });
}

/** @param {string[]} args */
function main([baselineDir, finalDir]) {
  if (!baselineDir || !finalDir) {
    console.error(
      'Usage: pnpm --filter web fidelity:compare <baseline run folder> <final run folder>',
    );
    return 2;
  }
  const dirs = {
    baseline: path.resolve(baselineDir),
    final: path.resolve(finalDir),
  };
  const read = (/** @type {string} */ dir) =>
    JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8'));
  const rows = compareRuns(read(dirs.baseline), read(dirs.final), (run, f) => {
    const file = path.join(dirs[run], f);
    return existsSync(file) ? readPng(file) : null;
  });
  const out = recordDir(path.join('compare', `runs-${stamp()}`));
  mkdirSync(path.join(out, 'side-by-side'), { recursive: true });
  for (const r of rows) {
    if (r.images && r.status === 'changed') {
      r.sideBySide = path.join('side-by-side', `${r.name}.png`);
      writePng(path.join(out, r.sideBySide), sideBySide(r.images));
    }
    delete r.images;
  }
  const count = (/** @type {string} */ s) => rows.filter((r) => r.status === s).length;
  const summary = {
    screens: rows.length,
    unchanged: count('unchanged'),
    changed: count('changed'),
    missing: count('missing'),
  };
  writeFileSync(
    path.join(out, 'report.json'),
    `${JSON.stringify({ kind: 'fidelity-runs', baseline: dirs.baseline, final: dirs.final, threshold: COMPARE_THRESHOLD, summary, rows }, null, 2)}\n`,
  );
  const listed = rows.filter((r) => r.status !== 'unchanged');
  writeFileSync(
    path.join(out, 'index.html'),
    page(
      'Fidelity runs compared',
      `<p>${esc(dirs.baseline)} → ${esc(dirs.final)}: ${summary.screens} screens, ${summary.unchanged} unchanged, ${summary.changed} changed, ${summary.missing} missing.</p>` +
        listed
          .map(
            (r) =>
              `<section><h2>${esc(r.name)}: ${esc(r.status)}</h2><p>${esc(r.note ?? `${r.changedPixels} pixels`)}</p>${r.sideBySide ? `<img src="${esc(r.sideBySide)}" alt="">` : ''}</section>`,
          )
          .join(''),
    ),
  );
  console.log(
    `Fidelity runs: ${summary.screens} screens, ${summary.unchanged} unchanged, ${summary.changed} changed, ${summary.missing} missing.`,
  );
  for (const r of listed)
    console.log(`  ${r.status}: ${r.name}${r.note ? ` (${r.note})` : ''}`);
  console.log(`Report: ${path.join(out, 'index.html')}`);
  return summary.changed || summary.missing ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
