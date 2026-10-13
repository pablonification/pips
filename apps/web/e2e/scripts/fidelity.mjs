// `pnpm --filter web fidelity`: the real app next to the locked prototype screens.
//
// Captures every screen that e2e/fidelity/screens.ts maps, at the locked screens' sizes (phone 390 × 800 @2x,
// tablet 834 × 1068, desktop 1440 × 956) in light and dark, then pairs each with
// ops/ui-revamp-review/runtime/extra/garis-v4/locked-2026-10-12/screens/<name>.png (216 screens). For each pair
// it computes a perceptual similarity (SSIM on luminance, 1 = identical) and the changed-pixel ratio, and writes
// a side-by-side image (prototype | app | difference). Unmapped screens show as "not built yet".
// Output: ops/redesign/fidelity/<timestamp>/index.html, with filters by layout, theme, persona and status.
//
// Status: "close" at SSIM ≥ 0.95, "different" below it. The command fails only if a capture fails.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  EXTRA_SCREENS,
  LAYOUTS,
  PROTOTYPE_ONLY,
  THEMES,
  screenNames,
} from '../fidelity/names.mjs';
import { FILTER_SCRIPT, filterSelect, page } from './lib/html.mjs';
import {
  cropTop,
  fit,
  pixelDiff,
  readPng,
  sideBySide,
  ssim,
  writePng,
} from './lib/image.mjs';
import { lockedScreensDir, recordDir, stamp } from './lib/paths.mjs';
import { esc, gitHead, playwright } from './lib/run.mjs';

export const CLOSE_SSIM = 0.95;
const locked = lockedScreensDir();
if (!locked) {
  console.error(
    'The locked prototype screens were not found (ops/ui-revamp-review/runtime/extra/garis-v4/locked-2026-10-12/screens/).',
  );
  process.exit(1);
}
const out = recordDir(path.join('fidelity', stamp()));
const appDir = path.join(out, 'app');
mkdirSync(appDir, { recursive: true });

const projects = LAYOUTS.flatMap((l) =>
  THEMES.map((t) => `fidelity-${l}-${t}`),
);
const code = playwright(projects, { E2E_FIDELITY_DIR: appDir }, [
  '--pass-with-no-tests',
  ...process.argv.slice(2),
]);

// Route screens, then the non-route ones (interactions, page sizes, the design-system page).
const names = [
  ...screenNames().map((s) => ({ ...s, kind: 'route', note: '' })),
  ...EXTRA_SCREENS.map((e) => ({
    name: e.name,
    layout: e.layout,
    theme: e.theme,
    persona: 'none',
    route: e.name,
    kind: 'extra',
    note: e.protoBar
      ? `${e.note ?? ''}; compared without that bar (the app has none)`
      : (e.note ?? ''),
    protoBar: e.protoBar ?? 0,
    viewportWidth: e.viewport.width,
  })),
];
const lockedFiles = new Set(
  readdirSync(locked).filter((f) => f.endsWith('.png')),
);
const rows = names.map((s) => {
  const lockedFile = path.join(locked, `${s.name}.png`);
  const appFile = path.join(appDir, `${s.name}.png`);
  const row = {
    ...s,
    prototype: path.relative(out, lockedFile),
    lockedExists: lockedFiles.has(`${s.name}.png`),
  };
  if (!existsSync(appFile)) return { ...row, status: 'not built yet' };
  const meta = JSON.parse(
    readFileSync(path.join(appDir, `${s.name}.json`), 'utf8'),
  );
  const lockedPng = readPng(lockedFile);
  // A 'page' screen: the prototype's own bar is cropped off (its device scale from the width).
  const proto =
    'protoBar' in s && s.protoBar
      ? cropTop(lockedPng, (s.protoBar * lockedPng.width) / s.viewportWidth)
      : lockedPng;
  const app = readPng(appFile);
  const score = ssim(proto, app);
  const d = pixelDiff(proto, fit(app, proto.width, proto.height));
  const sbs = path.join('side-by-side', `${s.name}.png`);
  mkdirSync(path.join(out, 'side-by-side'), { recursive: true });
  writePng(
    path.join(out, sbs),
    sideBySide([proto, app, d.diff], Math.min(proto.height, 1200)),
  );
  return {
    ...row,
    app: path.relative(out, appFile),
    url: meta.url,
    sideBySide: sbs,
    ssim: Number(score.toFixed(4)),
    changedPixelRatio: Number(d.ratio.toFixed(4)),
    sizeMatches: proto.width === app.width && proto.height === app.height,
    status: score >= CLOSE_SSIM ? 'close' : 'different',
  };
});
const unexpected = [...lockedFiles].filter(
  (f) =>
    !names.some((n) => `${n.name}.png` === f) &&
    !PROTOTYPE_ONLY.includes(f.replace(/\.png$/, '')),
);

/** @param {string} st */
const count = (st) => rows.filter((r) => r.status === st).length;
const report = {
  kind: 'pips-fidelity',
  createdAt: new Date().toISOString(),
  app: `apps/web at ${gitHead()}`,
  locked,
  closeAtSsim: CLOSE_SSIM,
  summary: {
    screens: rows.length,
    close: count('close'),
    different: count('different'),
    notBuiltYet: count('not built yet'),
    extras: rows.filter((r) => r.kind === 'extra').length,
    prototypeOnly: PROTOTYPE_ONLY.length,
    lockedScreensNotInList: unexpected,
  },
  captureExitCode: code,
  screens: rows,
};
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(out, 'index.html'), html(report));
const s = report.summary;
console.log(
  `\nFidelity: ${s.screens} locked screens (${s.extras} of them non-route): ${s.close} close, ${s.different} different, ${s.notBuiltYet} not built yet. ${s.prototypeOnly} prototype-only screens skipped.`,
);
if (unexpected.length)
  console.log(
    `Locked screens missing from e2e/fidelity/names.mjs: ${unexpected.join(', ')}`,
  );
console.log(`Report: ${path.join(out, 'index.html')}`);
process.exit(code);

/** @param {any} r */
function html(r) {
  const cards = r.screens
    .map((/** @type {any} */ row) => {
      const cls =
        row.status === 'close'
          ? 'ok'
          : row.status === 'different'
            ? 'bad'
            : 'none';
      const score =
        row.ssim != null
          ? ` · SSIM ${row.ssim.toFixed(3)} · ${(row.changedPixelRatio * 100).toFixed(1)} % pixels differ`
          : '';
      const media = row.sideBySide
        ? `<a href="${esc(row.sideBySide)}"><img loading="lazy" src="${esc(row.sideBySide)}" alt="${esc(`${row.name}: prototype, app, difference`)}"></a><p class="muted">prototype · app (${esc(row.url)}) · difference${row.sizeMatches ? '' : ' · sizes differ'}</p>`
        : `<div class="row"><figure><a href="${esc(row.prototype)}"><img loading="lazy" src="${esc(row.prototype)}" alt="${esc(`${row.name}: prototype`)}"></a><figcaption>prototype</figcaption></figure><figure><p>Not built yet: add <code>${esc(row.kind === 'extra' ? row.name : `${row.persona}-${row.route}`)}</code> to e2e/fidelity/${row.kind === 'extra' ? 'extras.ts' : 'screens.ts'}.</p></figure></div>`;
      return `<div class="card" data-card data-layout="${row.layout}" data-theme="${row.theme}" data-persona="${row.persona}" data-kind="${row.kind}" data-status="${row.status}">
  <h3>${esc(row.name)} <span class="tag ${cls}">${row.status}${score}</span></h3>${row.note ? `<p class="muted">${esc(row.note)}</p>` : ''}
  ${media}
</div>`;
    })
    .join('\n');
  const s = r.summary;
  const body = `<h1>Fidelity: the app next to the locked prototype</h1>
<p>${esc(r.app)}, ${esc(r.createdAt)}. Locked screens: ${esc(r.locked)}.</p>
<p><strong>${s.screens} screens: ${s.close} close, ${s.different} different, ${s.notBuiltYet} not built yet.</strong> “Close” means a perceptual similarity (SSIM on luminance) of at least ${r.closeAtSsim}. Read the pairs, not just the score: SSIM rewards matching layout and contrast, not matching words.</p>
<div class="filters">${filterSelect('layout', 'Layout', [...LAYOUTS])}${filterSelect('theme', 'Theme', [...THEMES])}${filterSelect('persona', 'Persona', ['anggota', 'pengurus', 'none'])}${filterSelect('kind', 'Kind', ['route', 'extra'])}${filterSelect('status', 'Status', ['close', 'different', 'not built yet'])}<span class="muted"><span id="count"></span> shown</span></div>
<div class="wide"><div class="grid">${cards}</div></div>`;
  return page('PIPS! fidelity', body, FILTER_SCRIPT);
}
