// `pnpm --filter web e2e:before`: records the "before" set of today's interface.
//
// Captures every state in e2e/capture/states.ts at phone and desktop size, light and dark, with axe and the other
// quality-gate measurements, then writes manifest.json and an index.html gallery to ops/redesign/before-set/.
// The before set is a record: it is never updated. A second run refuses to overwrite it unless
// E2E_BEFORE_OVERWRITE=1 (only for a set that was recorded wrongly).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { FILTER_SCRIPT, filterSelect, page } from './lib/html.mjs';
import { recordDir, redesignDir } from './lib/paths.mjs';
import {
  CAPTURE_PROJECTS,
  VARIANTS,
  esc,
  gitHead,
  playwright,
  readRecords,
} from './lib/run.mjs';

const dir = recordDir('before-set');
if (
  existsSync(path.join(dir, 'manifest.json')) &&
  process.env.E2E_BEFORE_OVERWRITE !== '1'
) {
  console.error(
    `The before set already exists at ${dir}.\nIt is a record and is never updated. To compare against it, run e2e:compare-before.`,
  );
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const code = playwright(CAPTURE_PROJECTS, { E2E_CAPTURE_DIR: dir });
const records = readRecords(dir);
const manifest = buildManifest(records);
writeFileSync(
  path.join(dir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
);
writeFileSync(path.join(dir, 'index.html'), gallery(manifest));
console.log(
  `\nBefore set: ${records.length} captures of ${manifest.states.length} states in ${dir}`,
);
console.log(`Gallery: ${path.join(dir, 'index.html')}`);
if (code !== 0)
  console.error(
    'Some captures failed; the set is incomplete. Fix them and record again with E2E_BEFORE_OVERWRITE=1.',
  );
process.exit(code);

function buildManifest(records) {
  const states = new Map();
  for (const r of records) {
    const s = states.get(r.id) ?? {
      id: r.id,
      title: r.title,
      persona: r.persona,
      path: r.path,
      variants: {},
    };
    s.variants[r.variant] = {
      image: r.image,
      url: r.url,
      size: `${r.width}×${r.height} @${r.deviceScaleFactor}x`,
      axe: {
        total: r.audit.axe.total,
        ...r.audit.axe.byImpact,
        rules: r.audit.axe.violations.map(
          (v) => `${v.id} (${v.impact}, ${v.nodes})`,
        ),
      },
      overflowX: r.audit.metrics.overflowX,
      smallText: r.audit.metrics.smallText.count,
      smallestTextPx: r.audit.metrics.smallText.minPx,
      lang: r.audit.metrics.lang,
    };
    states.set(r.id, s);
  }
  const all = [...states.values()];
  const sum = (key) =>
    records.reduce((n, r) => n + (r.audit.axe.byImpact[key] ?? 0), 0);
  return {
    kind: 'pips-before-set',
    recordedAt: new Date().toISOString(),
    app: `today's interface, apps/web at ${gitHead()}`,
    clock: 'Kamis, 8 Oktober 2026, 13.35 WIB (Asia/Jakarta), page.clock',
    fixtures: 'apps/web/e2e/fixtures (the locked prototype’s sample data)',
    variants: VARIANTS,
    totals: {
      captures: records.length,
      states: all.length,
      axeViolations: {
        critical: sum('critical'),
        serious: sum('serious'),
        moderate: sum('moderate'),
        minor: sum('minor'),
      },
    },
    states: all,
  };
}

function gallery(m) {
  const review = reviewCaptures();
  const cards = m.states
    .flatMap((s) =>
      VARIANTS.filter((v) => s.variants[v]).map((v) => {
        const c = s.variants[v];
        const serious = c.axe.critical + c.axe.serious;
        return `<div class="card" data-card data-variant="${v}" data-persona="${esc(s.persona)}" data-state="${esc(s.id)}">
  <h3>${esc(s.title)} <span class="muted">· ${v}</span></h3>
  <a href="${esc(c.image)}"><img loading="lazy" src="${esc(c.image)}" alt="${esc(`${s.title}, ${v}`)}"></a>
  <p><span class="tag">${esc(s.id)}</span><span class="tag">${esc(s.persona)}</span><span class="tag">${esc(s.path)}</span></p>
  <p><span class="tag ${serious ? 'bad' : 'ok'}">axe ${c.axe.critical} critical · ${c.axe.serious} serious · ${c.axe.moderate} moderate · ${c.axe.minor} minor</span>
  <span class="tag ${c.overflowX ? 'bad' : 'ok'}">overflow ${c.overflowX}px</span>
  <span class="tag ${c.smallText ? 'warn' : 'ok'}">${c.smallText} text under 12px${c.smallestTextPx ? ` (min ${c.smallestTextPx}px)` : ''}</span>
  <span class="tag ${c.lang === 'id' ? 'ok' : 'warn'}">lang=${esc(c.lang)}</span></p>
</div>`;
      }),
    )
    .join('\n');
  const t = m.totals;
  const body = `<h1>PIPS! before set</h1>
<p>${esc(m.app)}. Recorded ${esc(m.recordedAt)}. Clock: ${esc(m.clock)}. Fixtures: ${esc(m.fixtures)}.</p>
<p>${t.captures} captures of ${t.states} states at phone (390 × 844 @2x) and desktop (1440 × 900), light and dark. Today's app has no dark theme: the dark captures show that it ignores the setting.
Axe in total: ${t.axeViolations.critical} critical, ${t.axeViolations.serious} serious, ${t.axeViolations.moderate} moderate, ${t.axeViolations.minor} minor rule violations (one per rule per capture). Details in <a href="manifest.json">manifest.json</a>.</p>
${review}
<div class="filters">${filterSelect('variant', 'Size and theme', VARIANTS)}${filterSelect('persona', 'Persona', [...new Set(m.states.map((s) => s.persona))])}${filterSelect(
    'state',
    'State',
    m.states.map((s) => s.id),
  )}<span class="muted"><span id="count"></span> shown</span></div>
<div class="grid">${cards}</div>`;
  return page('PIPS! before set', body, FILTER_SCRIPT);
}

/** SPEC: the review's own captures (8 October 2026, commit 1e68e41) are part of the before set. */
function reviewCaptures() {
  const base = redesignDir();
  const runtime = base && path.join(base, '..', 'ui-revamp-review', 'runtime');
  if (!runtime || !existsSync(runtime)) return '';
  const groups = ['app/m390', 'app/m320', 'app/d1440', 'dark']
    .map((g) => [g, path.join(runtime, g)])
    .filter(([, d]) => existsSync(d))
    .map(([g, d]) => {
      const files = readdirSync(d)
        .filter((f) => f.endsWith('.png'))
        .sort();
      const rel = path.relative(dir, d);
      return `<li>${esc(g)}: ${files.map((f) => `<a href="${esc(path.join(rel, f))}">${esc(f)}</a>`).join(', ')}</li>`;
    });
  return groups.length
    ? `<h2>The UI review's captures (8 October 2026, frontend 1e68e41)</h2><p class="muted">Part of the before set, kept where the review wrote them (live API data, not these fixtures):</p><ul>${groups.join('')}</ul>`
    : '';
}
