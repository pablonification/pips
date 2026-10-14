// @ts-nocheck -- orchestration only: the logic it calls is in lib/review/, type-checked and unit-tested.
// `pnpm --filter web review`: builds the owner's review package (F1) in ops/redesign/review/ from a fresh production
// build, in one command. See e2e/review/README.md.
//
//   pnpm --filter web review                 every part, in order
//   pnpm --filter web review record          one part: build | pilot | record | fidelity | after | stills | checks |
//                                            lab | questions | index
//   pnpm --filter web review record --only beranda      one flow (record and pilot)
//
// Environment: REVIEW_FORCE=1 re-records flows whose MP4s exist; REVIEW_VIDEO=off runs the flows as tests only;
// REVIEW_WORKERS (default 2; 1 if a recording drops frames); REVIEW_OUT for another package folder; REVIEW_THEMES
// (light, dark-set, dark-rest; default from the size budget); E2E_PORT (default 4430, F1's range).
//
// It builds once per commit (e2e/.build, stamped with the commit), then runs every Playwright part with
// E2E_REUSE_BUILD=1. Before each part it runs the disk guard at the 1 GiB floor and stops below it. It records one
// flow at a time, converts each WebM to MP4, deletes the raw video, then moves on; an interrupted run picks up where
// it stopped, because a flow whose MP4s exist is skipped.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { readPng, resize, sideBySide, writePng } from './lib/image.mjs';
import { appDir, recordDir, redesignDir } from './lib/paths.mjs';
import { gitHead, readRecords } from './lib/run.mjs';
import {
  MiB,
  PARTS,
  fromPilot,
  packageBudget,
  planRecordings,
} from './lib/review/budget.mjs';
import {
  REMOVED,
  STATE_FLOWS,
  countsByProject,
  deviationFor,
  flowGrep,
  flowOfTitle,
  labSummary,
  ownerOfScreen,
  plannedRecordings,
  recordingStatus,
  releaseName,
  resultsOf,
} from './lib/review/data.mjs';
import { CSS, JS, buildIndex } from './lib/review/index.mjs';
import {
  CRF_STEPS,
  DEFAULT_CRF,
  POSTER_WIDTH,
  TOOLS,
  durationOf,
  frameArgs,
  missingTools,
  mp4Args,
  pickVideo,
  run,
  webpArgs,
} from './lib/review/media.mjs';
import {
  ciStepsAfterBuild,
  ghRetryArgs,
  parseGhJson,
} from './lib/review/ci.mjs';
import { buildQuestions, extractItems } from './lib/review/questions.mjs';
import { parseStill } from './lib/review/stills.mjs';

const PARTS_ORDER = [
  'build',
  'record',
  'fidelity',
  'after',
  'stills',
  'checks',
  'lab',
  'questions',
  'index',
];
const ALL_PARTS = ['build', 'pilot', 'ci', ...PARTS_ORDER.slice(1)];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const asked = args.filter(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--only',
);
for (const p of asked)
  if (!ALL_PARTS.includes(p)) {
    console.error(
      `review: unknown part "${p}". Parts: ${ALL_PARTS.join(', ')}.`,
    );
    process.exit(2);
  }
const parts = asked.length ? asked : PARTS_ORDER;

const repoDir = path.resolve(appDir, '..', '..');
const workspace = redesignDir();
const PKG = process.env.REVIEW_OUT
  ? path.resolve(process.env.REVIEW_OUT)
  : recordDir('review');
const MEDIA = path.join(PKG, 'media');
const DATA = path.join(PKG, 'data');
const WORK = path.join(appDir, 'e2e', '.review');
const RUNS = path.join(WORK, 'runs');
const PORT = process.env.E2E_PORT ?? '4430';
const WORKERS = process.env.REVIEW_WORKERS ?? '2';
const VIDEO = process.env.REVIEW_VIDEO !== 'off';
const FORCE = process.env.REVIEW_FORCE === '1';
const bin = (name) => path.join(appDir, 'node_modules', '.bin', name);
const today = new Date().toISOString();

const log = (/** @type {string} */ s) => console.log(`[review] ${s}`);
const readJson = (/** @type {string} */ f, /** @type {any} */ fallback) =>
  existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;
const writeJson = (/** @type {string} */ f, /** @type {any} */ v) => {
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
};

/** The disk guard at the budget's 1 GiB floor; stops the command below it. */
function diskGuard(part) {
  const script = workspace ? path.join(workspace, 'disk-guard.sh') : null;
  if (!script || !existsSync(script))
    return log(`no disk guard here (${part}); continuing`);
  const r = spawnSync('bash', [script], {
    env: { ...process.env, MIN_FREE_GB: '1' },
    encoding: 'utf8',
  });
  process.stdout.write(r.stdout ?? '');
  if (r.status !== 0) {
    process.stderr.write(r.stderr ?? '');
    console.error(
      `[review] stopped before "${part}": under the 1 GiB floor. Free space, then run it again (it resumes).`,
    );
    process.exit(3);
  }
}

/** Free bytes on the disk the package is on. */
function freeBytes() {
  const r = spawnSync('df', ['-k', appDir], { encoding: 'utf8' });
  const kb = Number(
    (r.stdout ?? '').trim().split('\n').at(-1)?.split(/\s+/)[3],
  );
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

/** The review's TypeScript data (catalogue, coverage, findings, stills), through tsx. */
let dumped = null;
function dump() {
  if (dumped) return dumped;
  const r = spawnSync(bin('tsx'), ['e2e/review/dump.ts'], {
    cwd: appDir,
    encoding: 'utf8',
    maxBuffer: 64 * MiB,
  });
  if (r.status !== 0) throw new Error(`dump.ts failed: ${r.stderr}`);
  return (dumped = JSON.parse(r.stdout));
}

/** Playwright with the harness config, reusing the build; JSON results to `json`. */
function playwright(projects, extra, env, json) {
  const r = spawnSync(
    bin('playwright'),
    [
      'test',
      '-c',
      'e2e',
      ...projects.map((p) => `--project=${p}`),
      '--reporter=list,json',
      ...extra,
    ],
    {
      cwd: appDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_REUSE_BUILD: '1',
        E2E_PORT: PORT,
        E2E_WORKERS: WORKERS,
        ...(json ? { PLAYWRIGHT_JSON_OUTPUT_NAME: json } : {}),
        ...env,
      },
    },
  );
  return r.status ?? 1;
}

/** Bytes under a folder. */
function sizeOf(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? sizeOf(p) : statSync(p).size;
  }
  return n;
}

/** PNG → WebP in the package, `width` CSS px wide when given. */
function webp(png, out, width) {
  mkdirSync(path.dirname(out), { recursive: true });
  run(TOOLS.cwebp, webpArgs(png, out, { q: 80, width }));
}

function needTools() {
  const missing = missingTools();
  if (missing.length) {
    console.error(
      `[review] missing: ${missing.join(', ')}. Nothing is installed by this script; stopping.`,
    );
    process.exit(4);
  }
}

// ---------------------------------------------------------------- build

function build() {
  diskGuard('build');
  const stampFile = path.join(appDir, 'e2e', '.build', '.review-commit');
  const head = gitHead();
  if (
    !head.includes('uncommitted') &&
    existsSync(stampFile) &&
    readFileSync(stampFile, 'utf8') === head
  )
    return log(`build: e2e/.build is ${head}'s; reused`);
  log(`build: a production build of ${head}`);
  const r = spawnSync('node', ['e2e/scripts/serve.mjs'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, E2E_BUILD_ONLY: '1', E2E_REUSE_BUILD: '' },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  writeFileSync(stampFile, head);
}

// ---------------------------------------------------------------- recordings

const STATE = path.join(WORK, 'recordings.json');

/** Records one flow in one theme, converts what it recorded, and remembers each recording's result. */
function recordFlow(flow, theme, crf) {
  const planned = plannedRecordings(flow, theme);
  if (!planned.length) return;
  const state = readJson(STATE, {});
  const done = planned.every(
    (p) => existsSync(path.join(PKG, p.file)) && state[`${p.flow}|${p.name}`],
  );
  if (done && !FORCE && VIDEO)
    return log(
      `record ${flow.id} (${theme}): already recorded, skipped (REVIEW_FORCE=1 to redo)`,
    );
  diskGuard(`record ${flow.id}`);
  rmSync(RUNS, { recursive: true, force: true });
  const json = path.join(WORK, 'json', `${flow.id}-${theme}.json`);
  mkdirSync(path.dirname(json), { recursive: true });
  const projects = [...new Set(planned.map((p) => p.project))];
  playwright(
    projects,
    ['--grep', flowGrep(flow.id)],
    { REVIEW_RUN_DIR: RUNS },
    json,
  );
  const rows = resultsOf(readJson(json, {}));
  for (const p of planned) {
    const row = rows.find(
      (r) =>
        r.project === p.project &&
        flowOfTitle(r.title)?.variant === p.variant &&
        flowOfTitle(r.title)?.flow === p.flow,
    );
    const recFile = path.join(
      RUNS,
      `${p.flow}__${p.variant}__${p.project}.json`,
    );
    const rec = readJson(recFile, null);
    const entry = {
      ...p,
      status: recordingStatus(row),
      knownFailure: rec?.knownFailure ?? null,
      error: rec?.error ?? null,
      steps: rec?.steps ?? [],
      gates: (rec?.gates ?? []).map((g) => ({
        name: g.name,
        failures: g.failures,
      })),
      guard: rec?.guard ?? null,
      durationMs: rec?.durationMs ?? null,
      seconds: null,
      bytes: null,
      file: null,
      poster: null,
    };
    if (rec && VIDEO) {
      const webm = existsSync(rec.outputDir)
        ? pickVideo(
            readdirSync(rec.outputDir).map((name) => ({
              name,
              size: statSync(path.join(rec.outputDir, name)).size,
            })),
            rec.videoFile,
          )
        : null;
      if (webm) {
        const raw = path.join(rec.outputDir, webm);
        const mp4 = path.join(PKG, p.file);
        mkdirSync(path.dirname(mp4), { recursive: true });
        run(TOOLS.ffmpeg, mp4Args(raw, mp4, { crf }));
        const seconds = durationOf(mp4) ?? 0;
        const frame = path.join(rec.outputDir, 'poster.png');
        run(TOOLS.ffmpeg, frameArgs(mp4, frame, Math.min(2.5, seconds / 2)));
        webp(frame, path.join(PKG, p.poster), POSTER_WIDTH);
        Object.assign(entry, {
          file: p.file,
          poster: p.poster,
          seconds,
          bytes: statSync(mp4).size,
        });
      } else log(`record ${flow.id}: no video for ${p.name}`);
      // A known failure keeps its trace for F2 (one per finding).
      const trace = path.join(rec.outputDir, 'known-failure-trace.zip');
      const id = rec.knownFailure?.split(':')[0];
      const keep = id && path.join(MEDIA, 'traces', `${id}.zip`);
      if (keep && existsSync(trace) && !existsSync(keep)) {
        mkdirSync(path.dirname(keep), { recursive: true });
        copyFileSync(trace, keep);
      }
    }
    if (rec?.outputDir) rmSync(rec.outputDir, { recursive: true, force: true });
    state[`${p.flow}|${p.name}`] = entry;
  }
  writeJson(STATE, state);
}

/** The flows' data file from the catalogue and the recordings' results. */
function writeFlowsJson() {
  const d = dump();
  const state = readJson(STATE, {});
  const questions = readJson(path.join(DATA, 'questions.json'), { groups: [] });
  const allQ = questions.groups.flatMap((g) => g.items);
  const flows = d.flows.map((f) => {
    const recordings = ['light', 'dark']
      .flatMap((t) => plannedRecordings(f, t))
      .map(
        (p) =>
          state[`${p.flow}|${p.name}`] ?? {
            ...p,
            status: 'not recorded',
            file: null,
            poster: null,
            steps: [],
          },
      );
    const ids = [...new Set(f.check.match(/\b[ADC]\d{1,2}\b/g) ?? [])];
    const finding = d.findings.find((x) => x.flows.includes(f.id) && !x.fixed);
    return {
      ...f,
      knownFailure: finding ? `${finding.id}: ${finding.title}` : null,
      recordings,
      beforeAfter: Object.entries(STATE_FLOWS)
        .filter(([, fl]) => fl.includes(f.id))
        .map(([s]) => s),
      questions: [
        ...ids.map((id) => {
          const q = allQ.find((x) => x.id === id);
          return q ? `${id}: ${q.question}` : id;
        }),
        ...(finding ? [`${finding.id}: ${finding.title}`] : []),
      ],
    };
  });
  writeJson(path.join(DATA, 'flows.json'), {
    createdAt: today,
    commit: gitHead(),
    flows,
  });
}

function recordingsByPhase(d) {
  const all = d.flows.filter((f) => !only || f.id === only);
  return {
    light: all.map((f) => ({ f, theme: 'light' })),
    'dark-set': all.filter((f) => f.darkSet).map((f) => ({ f, theme: 'dark' })),
    'dark-rest': all
      .filter((f) => !f.darkSet)
      .map((f) => ({ f, theme: 'dark' })),
  };
}

function plan(d) {
  const sizes = readJson(path.join(DATA, 'sizes.json'), {});
  const pilot = sizes.pilot
    ? {
        kbps: sizes.pilot.kbps,
        secondsPerRecording: sizes.pilot.secondsPerRecording,
      }
    : fromPilot([]);
  const secs = (list) =>
    list
      .flatMap(({ f, theme }) => plannedRecordings(f, theme))
      .map((p) => ({ layout: p.layout, seconds: pilot.secondsPerRecording }));
  const phases = recordingsByPhase(d);
  const free = freeBytes();
  const budget = packageBudget(free, sizeOf(MEDIA));
  const p = planRecordings({
    budget,
    light: secs(phases.light),
    darkSet: secs(phases['dark-set']),
    darkRest: secs(phases['dark-rest']),
    kbps: pilot.kbps,
  });
  writeJson(path.join(DATA, 'sizes.json'), {
    ...sizes,
    measuredAt: today,
    freeBytes: free,
    mediaBytesAtPlan: sizeOf(MEDIA),
    budget,
    plan: p,
  });
  return {
    ...p,
    phases: process.env.REVIEW_THEMES
      ? process.env.REVIEW_THEMES.split(',')
      : p.phases,
  };
}

function record() {
  needTools();
  const d = dump();
  // Nothing left to record (a rerun of the whole command, or after an interrupted one finished): keep the plan the
  // recordings were made with instead of re-planning from today's free space, which can refuse with nothing to do.
  const state = readJson(STATE, {});
  const left = Object.values(recordingsByPhase(d))
    .flat()
    .flatMap(({ f, theme }) => plannedRecordings(f, theme))
    .filter(
      (p) =>
        !existsSync(path.join(PKG, p.file)) || !state[`${p.flow}|${p.name}`],
    );
  if (VIDEO && !FORCE && !left.length) {
    log('record: every recording exists; nothing to record');
    writeFlowsJson();
    return;
  }
  const p = VIDEO
    ? plan(d)
    : {
        ok: true,
        crf: DEFAULT_CRF,
        phases: ['light', 'dark-set', 'dark-rest'],
        reason: '',
      };
  if (!p.ok) {
    console.error(`[review] not recording: ${p.reason}.`);
    process.exit(5);
  }
  log(
    `record: ${p.phases.join(', ')} at CRF ${p.crf}${p.reason ? ` (${p.reason})` : ''}`,
  );
  const phases = recordingsByPhase(d);
  for (const phase of p.phases)
    for (const { f, theme } of phases[phase]) recordFlow(f, theme, p.crf);
  writeFlowsJson();
}

/** The pilot: beranda, pengumuman-unread and form-pixel at three layouts in light; KB per second and seconds. */
function pilot() {
  needTools();
  const d = dump();
  for (const id of ['beranda', 'pengumuman-unread', 'form-pixel'])
    recordFlow(
      d.flows.find((f) => f.id === id),
      'light',
      DEFAULT_CRF,
    );
  const state = readJson(STATE, {});
  const recs = Object.values(state).filter(
    (r) =>
      ['beranda', 'pengumuman-unread', 'form-pixel'].includes(r.flow) &&
      r.bytes,
  );
  const measured = fromPilot(
    recs.map((r) => ({ layout: r.layout, seconds: r.seconds, bytes: r.bytes })),
  );
  const sizes = readJson(path.join(DATA, 'sizes.json'), {});
  writeJson(path.join(DATA, 'sizes.json'), {
    ...sizes,
    pilot: {
      at: today,
      recordings: recs.length,
      ...measured,
      crf: DEFAULT_CRF,
      crfSteps: CRF_STEPS,
    },
  });
  plan(d);
  log(`pilot: ${JSON.stringify(measured)}`);
}

// ---------------------------------------------------------------- fidelity

/** The newest run folder under ops/redesign/<kind>/ that this command made, and forget (delete) the older ones. */
function latestRun(kind) {
  const base = recordDir(kind);
  const mine = readJson(path.join(WORK, `${kind}-runs.json`), []);
  const dirs = existsSync(base)
    ? readdirSync(base)
        .filter((n) => /^\d{4}-\d\d-\d\dT/.test(n))
        .sort()
    : [];
  const newest = dirs.at(-1);
  if (!newest) return null;
  for (const old of mine.filter((n) => n !== newest))
    rmSync(path.join(base, old), { recursive: true, force: true });
  writeJson(path.join(WORK, `${kind}-runs.json`), [newest]);
  return path.join(base, newest);
}

/** A PNG's size from its header, without decoding it. */
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function reportItems() {
  if (!workspace) return [];
  const dir = path.join(workspace, 'reports');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) =>
      extractItems(
        readFileSync(path.join(dir, f), 'utf8'),
        `ops/redesign/reports/${f}`,
      ),
    );
}

function fidelity() {
  needTools();
  const d = dump();
  diskGuard('fidelity');
  const r = spawnSync('node', ['e2e/scripts/fidelity.mjs'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, E2E_REUSE_BUILD: '1', E2E_PORT: PORT },
  });
  const dir = latestRun('fidelity');
  if (!dir) throw new Error('fidelity: no report');
  const report = readJson(path.join(dir, 'report.json'), {});
  const items = reportItems();
  const screens = [];
  for (const s of report.screens) {
    const owner = ownerOfScreen(s.name);
    const row = {
      name: s.name,
      layout: s.layout,
      theme: s.theme,
      persona: s.persona,
      kind: s.kind,
      owner,
      ssim: s.ssim ?? null,
      changed: s.changedPixelRatio ?? null,
    };
    if (!s.sideBySide) {
      screens.push({ ...row, status: 'not built yet' });
      continue;
    }
    const out = `media/fidelity/${s.name}.webp`;
    // Each panel at CSS-pixel size: phone screens are 2×, and the side-by-side is drawn at most 1200 px tall.
    const sbs = pngSize(path.join(dir, s.sideBySide));
    const protoH =
      pngSize(path.join(dir, s.prototype)).height -
      (s.protoBar ? s.protoBar * 2 : 0);
    const drawn = Math.min(protoH, 1200);
    const width =
      s.layout === 'phone'
        ? Math.round((sbs.width * (protoH / 2 + 32)) / (drawn + 32))
        : undefined;
    webp(path.join(dir, s.sideBySide), path.join(PKG, out), width);
    // A hand-checked note (review/fidelity-notes.ts) wins over the text search in the owner's Deviations.
    const note = d.fidelityNotes.find((n) => n.screens.includes(s.name));
    const deviation =
      s.status !== 'different'
        ? null
        : note
          ? `${note.reason} (${note.source})`
          : deviationFor(
              s.name,
              items.filter((i) => i.source.file.includes(owner.split(' ')[0])),
            );
    screens.push({
      ...row,
      sideBySide: out,
      deviation,
      status: s.status === 'different' && !deviation ? 'unexplained' : s.status,
    });
  }
  for (const name of prototypeOnly())
    screens.push({
      name,
      layout: '',
      theme: '',
      persona: 'none',
      kind: 'prototype',
      owner: '–',
      status: 'prototype only',
    });
  const count = (st) => screens.filter((x) => x.status === st).length;
  writeJson(path.join(DATA, 'fidelity.json'), {
    run: path.relative(repoDir, dir),
    captureExitCode: report.captureExitCode,
    lockedScreensNotInList: report.summary?.lockedScreensNotInList ?? [],
    summary: {
      close: count('close'),
      different: count('different'),
      unexplained: count('unexplained'),
      notBuiltYet: count('not built yet'),
      prototypeOnly: count('prototype only'),
    },
    screens,
  });
  if (r.status !== 0)
    log(`fidelity: the capture run exited ${r.status}; see ${dir}`);
}
/** The 11 prototype-only screens' names (fidelity/names.mjs). */
function prototypeOnly() {
  const r = spawnSync(
    'node',
    [
      '-e',
      "import('./e2e/fidelity/names.mjs').then(m=>process.stdout.write(JSON.stringify(m.PROTOTYPE_ONLY)))",
    ],
    { cwd: appDir, encoding: 'utf8' },
  );
  return JSON.parse(r.stdout || '[]');
}

// ---------------------------------------------------------------- before and after

function after() {
  needTools();
  diskGuard('after');
  spawnSync('node', ['e2e/scripts/compare-before.mjs'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, E2E_REUSE_BUILD: '1', E2E_PORT: PORT },
  });
  const dir = latestRun('compare');
  if (!dir) throw new Error('after: no compare report');
  const report = readJson(path.join(dir, 'report.json'), {});
  const recs = new Map(
    readRecords(path.join(dir, 'after')).map((r) => [
      `${r.variant}/${r.id}`,
      r,
    ]),
  );
  const manifest = readJson(
    path.join(workspace ?? '', 'before-set', 'manifest.json'),
    { states: [], totals: {} },
  );
  const beforeOf = (id, variant) =>
    manifest.states.find((s) => s.id === id)?.variants?.[variant];
  const tmp = path.join(WORK, 'pairs');
  mkdirSync(tmp, { recursive: true });
  const pairs = [];
  const after = { critical: 0, serious: 0, captures: 0 };
  for (const row of report.states ?? []) {
    const b = beforeOf(row.id, row.variant);
    const a = recs.get(`${row.variant}/${row.id}`);
    const before = b
      ? {
          axe: b.axe,
          overflowX: b.overflowX,
          smallText: b.smallText,
          minPx: b.smallestTextPx,
          lang: b.lang,
        }
      : null;
    const aft = a
      ? {
          axe: a.audit.axe.byImpact,
          overflowX: a.audit.metrics.overflowX,
          smallText: a.audit.metrics.smallText.count,
          minPx: a.audit.metrics.smallText.minPx,
          lang: a.audit.metrics.lang,
        }
      : null;
    if (aft) {
      after.critical += aft.axe.critical;
      after.serious += aft.axe.serious;
      after.captures++;
    }
    let image = null;
    if (row.before && row.after) {
      const ib = readPng(path.join(dir, row.before));
      const ia = readPng(path.join(dir, row.after));
      const half = row.variant.startsWith('phone');
      const pair = sideBySide([
        half ? resize(ib, ib.width / 2, ib.height / 2) : ib,
        half ? resize(ia, ia.width / 2, ia.height / 2) : ia,
      ]);
      const png = path.join(tmp, `${row.variant}-${row.id}.png`);
      writePng(png, pair);
      image = `media/before-after/${row.variant}/${row.id}.webp`;
      webp(png, path.join(PKG, image));
      rmSync(png);
    }
    pairs.push({
      id: row.id,
      title: row.title,
      variant: row.variant,
      status: REMOVED[row.id]
        ? 'removed'
        : row.status === 'missing'
          ? 'missing'
          : 'paired',
      reason:
        REMOVED[row.id] ??
        (row.status === 'missing' ? 'no after capture' : null),
      image,
      before,
      after: aft,
      flows: STATE_FLOWS[row.id] ?? [],
    });
  }
  rmSync(tmp, { recursive: true, force: true });
  writeJson(path.join(DATA, 'before-after.json'), {
    run: path.relative(repoDir, dir),
    captureExitCode: report.captureExitCode,
    missing: pairs
      .filter((p) => p.status === 'missing')
      .map((p) => `${p.variant}/${p.id}`),
    totals: {
      before: {
        ...manifest.totals?.axeViolations,
        captures: manifest.totals?.captures ?? 200,
      },
      after,
    },
    pairs,
  });
}

// ---------------------------------------------------------------- stills

function stills() {
  needTools();
  const d = dump();
  const out = path.join(WORK, 'stills');
  rmSync(out, { recursive: true, force: true });
  const PROJECTS = {
    fidelity: ['phone', 'tablet', 'desk'].flatMap((l) =>
      ['light', 'dark'].map((t) => `fidelity-${l}-${t}`),
    ),
    journeys: ['phone', 'tablet', 'desktop'].flatMap((l) =>
      ['light', 'dark'].map((t) => `${l}-${t}`),
    ),
    'review-stills': ['phone', 'tablet', 'desktop'].flatMap((l) =>
      ['light', 'dark'].map((t) => `review-stills-${l}-${t}`),
    ),
  };
  for (const src of d.stillSources) {
    diskGuard(`stills ${src.id}`);
    const dir = path.join(out, src.id);
    mkdirSync(dir, { recursive: true });
    playwright(
      PROJECTS[src.projects],
      [src.spec],
      { [src.env]: dir },
      path.join(WORK, 'json', `stills-${src.id}.json`),
    );
  }
  /** @type {Map<string, any>} */
  const byState = new Map();
  for (const src of d.stillSources) {
    const dir = path.join(out, src.id);
    for (const file of existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.png'))
      : []) {
      const p = parseStill(src.id, file);
      if (!p) continue;
      const key = `${src.id.toLowerCase()}-${p.state}`;
      const state = d.stillStates.find((s) => s.id === p.state);
      const entry = byState.get(key) ?? {
        id: key,
        title: state?.title ?? p.state.replace(/-/g, ' '),
        owner: state?.owner ?? src.owner,
        source: state?.source ?? src.source,
        images: [],
      };
      const png = path.join(dir, file);
      const img = readPng(png);
      const rel = `media/stills/${key}/${p.layout}-${p.theme}.webp`;
      // Phones are captured at 2×: halve them to CSS pixels.
      webp(
        png,
        path.join(PKG, rel),
        p.layout === 'phone' ? Math.round(img.width / 2) : undefined,
      );
      entry.images.push({ layout: p.layout, theme: p.theme, file: rel });
      byState.set(key, entry);
    }
  }
  const icons = [];
  for (const i of d.appIcons) {
    const from = path.join(appDir, 'public', i.file);
    if (!existsSync(from)) continue;
    const rel = `media/stills/app-icons/${i.file}`;
    mkdirSync(path.dirname(path.join(PKG, rel)), { recursive: true });
    copyFileSync(from, path.join(PKG, rel));
    icons.push({ file: rel, title: i.title });
  }
  writeJson(path.join(DATA, 'stills.json'), {
    stills: [...byState.values()],
    appIcons: icons,
    oldFiles: d.oldIcons.filter((f) =>
      existsSync(path.join(appDir, 'public', f)),
    ),
  });
  rmSync(out, { recursive: true, force: true });
}

// ---------------------------------------------------------------- checks

function sh(cmd, argv, cwd, env = {}) {
  const r = spawnSync(cmd, argv, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 256 * MiB,
  });
  return { status: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const tail = (s, n = 15) => s.trim().split('\n').slice(-n);

function checks() {
  const d = dump();
  const commit = gitHead();
  const date = new Date().toISOString();
  const list = [];
  const add = (c) => {
    list.push({ date, commit, ...c });
    writeJson(path.join(DATA, 'checks.json'), { checks: list });
  };
  diskGuard('checks');
  for (const [id, title, cmd] of [
    ['repo-check', 'Type check and lint (pnpm check)', ['check']],
    [
      'repo-test',
      'Unit tests, web and api, and the API start test (pnpm test)',
      ['test'],
    ],
    ['repo-build', 'Production builds (pnpm build)', ['build']],
  ]) {
    const r = sh('pnpm', cmd, repoDir);
    add({
      id,
      title,
      command: `pnpm ${cmd.join(' ')}`,
      status: r.status === 0 ? 'green' : 'red',
      failures: r.status ? tail(r.out) : [],
    });
  }
  // Every step check.yml runs after "Production build".
  const ci = readFileSync(
    path.join(repoDir, '.github', 'workflows', 'check.yml'),
    'utf8',
  );
  const steps = ciStepsAfterBuild(ci);
  for (const s of steps.length
    ? steps
    : [
        {
          name: 'Production bundle check',
          run: 'node apps/web/scripts/verify-production-bundle.mjs apps/web/dist',
        },
      ]) {
    const r = sh('bash', ['-c', s.run], repoDir);
    add({
      id: `ci-${s.name.toLowerCase().replace(/\W+/g, '-')}`,
      title: `CI step after the build: ${s.name}`,
      command: s.run,
      status: r.status === 0 ? 'green' : 'red',
      failures: r.status ? tail(r.out) : [],
    });
  }
  // Budgets (C1's post-build check), strict.
  const budgets = path.join(WORK, 'budgets.json');
  const b = sh(
    'pnpm',
    ['--filter', 'web', 'budgets', '--json', budgets],
    repoDir,
    { BUDGETS_STRICT: '1' },
  );
  add({
    id: 'budgets',
    title: d.checks.budgets,
    command: 'BUDGETS_STRICT=1 pnpm --filter web budgets --json <file>',
    status: b.status === 0 ? 'green' : 'red',
    failures: b.status ? tail(b.out) : [],
    details: readJson(budgets, null),
  });
  // The whole journey suite, strict.
  diskGuard('journeys');
  const jj = path.join(WORK, 'json', 'journeys.json');
  const j = sh(
    'pnpm',
    ['--filter', 'web', 'e2e', '--reporter=list,json'],
    repoDir,
    {
      E2E_GATES: 'strict',
      E2E_REUSE_BUILD: '1',
      E2E_PORT: PORT,
      E2E_WORKERS: WORKERS,
      PLAYWRIGHT_JSON_OUTPUT_NAME: jj,
    },
  );
  const jr = resultsOf(readJson(jj, {}));
  const failed = jr.filter(
    (r) => r.status !== r.expected && r.status !== 'skipped',
  );
  const byProject = countsByProject(jr);
  add({
    id: 'journeys',
    title: d.checks.journeys,
    command: 'E2E_GATES=strict pnpm --filter web e2e',
    status: j.status === 0 && !failed.length ? 'green' : 'red',
    counts: Object.fromEntries(
      Object.entries(byProject).map(([p, c]) => [
        p,
        `${c.passed} passed, ${c.failed} failed`,
      ]),
    ),
    failures: failed.map((f) => `${f.project} › ${f.title}`),
  });
  const visual = Object.entries(byProject).filter(([p]) =>
    p.startsWith('visual-'),
  );
  add({
    id: 'visual-mac',
    title: `${d.checks.visual}: this Mac (…-darwin.png), from the journey run`,
    command: 'part of pnpm --filter web e2e',
    status: visual.every(([, c]) => !c.failed) ? 'green' : 'red',
    counts: Object.fromEntries(
      visual.map(([p, c]) => [p, `${c.passed} passed, ${c.failed} failed`]),
    ),
  });
  // The sweep.
  diskGuard('sweep');
  const sj = path.join(WORK, 'json', 'sweep.json');
  const sweepProjects = [
    '320',
    '390',
    '768',
    '1024',
    '1440',
    'zoom200',
  ].flatMap((w) => ['light', 'dark'].map((t) => `review-sweep-${w}-${t}`));
  playwright(sweepProjects, [], {}, sj);
  const sr = resultsOf(readJson(sj, {}));
  const sf = sr.filter(
    (r) => r.status !== r.expected && r.status !== 'skipped',
  );
  add({
    id: 'sweep',
    title: d.checks.sweep,
    command: 'playwright --project=review-sweep-*',
    status: sr.length && !sf.length ? 'green' : 'red',
    counts: { passed: sr.length - sf.length, failed: sf.length },
    failures: sf.map((f) => `${f.project} › ${f.title}`),
  });
  // Contrast: the token and theme tests, and axe's colour-contrast failures in the sweep.
  const t = sh(
    'node',
    ['--test', 'tests/garis-tokens.test.mjs', 'tests/garis-theme.test.mjs'],
    appDir,
  );
  add({
    id: 'contrast',
    title: d.checks.contrast,
    command:
      'node --test tests/garis-tokens.test.mjs tests/garis-theme.test.mjs; the sweep’s axe',
    status: t.status === 0 ? 'green' : 'red',
    failures: t.status ? tail(t.out) : [],
    note: 'axe’s colour-contrast results are in the sweep’s failures above.',
  });
  // CI, read only.
  add(ciCheck());
  add({
    id: 'staging',
    title: 'Staging smoke test (ops/redesign/smoke-staging.sh)',
    status: 'slot',
    note: 'Dev 1 runs it: it needs the old server’s test account.',
  });
  const fid = readJson(path.join(DATA, 'fidelity.json'), null);
  if (fid)
    add({
      id: 'fidelity',
      title: d.checks.fidelity,
      status:
        fid.summary.unexplained || fid.lockedScreensNotInList.length
          ? 'red'
          : 'green',
      counts: fid.summary,
    });
  const ba = readJson(path.join(DATA, 'before-after.json'), null);
  if (ba)
    add({
      id: 'before-after',
      title: d.checks.beforeAfter,
      status: ba.captureExitCode === 0 && !ba.missing.length ? 'green' : 'red',
      counts: { pairs: ba.pairs.length, missing: ba.missing.length },
    });
  for (const [id, title] of [
    ['screen-readers', 'TalkBack, VoiceOver and NVDA (SPEC "Accessibility")'],
    [
      'usability',
      'The five-student usability test and the tree test (SPEC "Delivery")',
    ],
    ['field', 'Field metrics (no monitoring backend)'],
  ])
    add({
      id,
      title,
      status: 'needs a person',
      note: 'Not run by F1: it needs a person.',
    });
}
/** GitHub through ops/redesign/gh-retry.sh (read only), as JSON; null when it can't be read. */
function gh(args) {
  const retry = workspace ? path.join(workspace, 'gh-retry.sh') : null;
  if (!retry) return null;
  // gh-retry.sh takes its time limit, then `--`, then the command (without `--` it read "gh" as the limit).
  const r = sh('bash', ghRetryArgs(retry, args), repoDir);
  return r.status === 0 ? parseGhJson(r.out) : null;
}

/** The CI check: the latest runs on redesign, every merged task's pull request, and the last one's checks. */
function ciCheck() {
  const repo = ['--repo', 'pablonification/pips'];
  const runs = gh([
    'run',
    'list',
    ...repo,
    '--branch',
    'redesign',
    '--limit',
    '5',
    '--json',
    'databaseId,conclusion,headSha,url,workflowName,createdAt,event',
  ]);
  const pullRequests = gh([
    'pr',
    'list',
    ...repo,
    '--state',
    'merged',
    '--base',
    'redesign',
    '--limit',
    '40',
    '--json',
    'number,title,url,mergedAt',
  ]);
  const last = Array.isArray(pullRequests)
    ? [...pullRequests].sort((a, b) => (a.mergedAt < b.mergedAt ? 1 : -1))[0]
    : null;
  const lastPr = last
    ? gh([
        'pr',
        'view',
        String(last.number),
        ...repo,
        '--json',
        'number,title,url,statusCheckRollup',
      ])
    : null;
  // Check runs have name and conclusion; commit statuses (another app's) have context and state.
  const checks = (lastPr?.statusCheckRollup ?? []).map((c) => ({
    name: c.name ?? c.context,
    conclusion: c.conclusion ?? c.state,
    url: c.detailsUrl ?? c.targetUrl,
  }));
  const read = Array.isArray(runs) && Array.isArray(pullRequests);
  const failing = checks.filter(
    (c) =>
      c.conclusion && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(c.conclusion),
  );
  return {
    date: new Date().toISOString(),
    commit: gitHead(),
    id: 'ci',
    title:
      'CI on GitHub: the latest runs on redesign and every merged task’s pull request',
    command:
      'ops/redesign/gh-retry.sh 5 -- gh run list / gh pr list / gh pr view (read only)',
    status: !read ? 'slot' : failing.length ? 'red' : 'green',
    counts: read
      ? {
          'runs on redesign': runs.length,
          'merged pull requests': pullRequests.length,
          [`#${lastPr?.number ?? '?'} checks`]: `${checks.length - failing.length} passed, ${failing.length} failed`,
        }
      : undefined,
    failures: failing.map(
      (c) => `#${lastPr.number} › ${c.name}: ${c.conclusion}`,
    ),
    note: read
      ? `A push to redesign runs check, test, build and the Docker images; the journeys and the Linux visual references run only on pull requests, so they come from the last merged pull request, #${lastPr?.number ?? '?'}.`
      : 'gh couldn’t read GitHub here: Dev 1 fills this in.',
    details: {
      runs,
      pullRequests,
      lastPullRequest: lastPr ? { ...lastPr, statusCheckRollup: checks } : null,
    },
  };
}

/** `review ci`: refreshes only the CI check in checks.json. */
function ci() {
  const file = path.join(DATA, 'checks.json');
  const c = readJson(file, { checks: [] });
  const entry = ciCheck();
  const at = c.checks.findIndex((x) => x.id === 'ci');
  if (at >= 0) c.checks[at] = entry;
  else c.checks.push(entry);
  writeJson(file, c);
  log(
    `ci: ${entry.status}${entry.counts ? ` ${JSON.stringify(entry.counts)}` : ''}`,
  );
}

// ---------------------------------------------------------------- lab

function lab() {
  diskGuard('lab');
  const out = path.join(WORK, 'lab.jsonl');
  rmSync(out, { force: true });
  playwright(
    ['review-lab-phone'],
    [],
    { REVIEW_LAB_OUT: out, E2E_WORKERS: '1' },
    path.join(WORK, 'json', 'lab.json'),
  );
  const lines = existsSync(out)
    ? readFileSync(out, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const summary = labSummary(lines);
  const checksFile = path.join(DATA, 'checks.json');
  const c = readJson(checksFile, { checks: [] });
  c.checks = c.checks.filter((x) => x.id !== 'lab');
  c.checks.push({
    id: 'lab',
    title: dump().checks.lab,
    date: today,
    commit: gitHead(),
    command: 'playwright --project=review-lab-phone',
    status:
      summary.rows.length && summary.rows.every((r) => !r.overBudget.length)
        ? 'green'
        : 'red',
    counts: Object.fromEntries(
      summary.rows.map((r) => [
        r.route,
        `FCP ${r.fcp} ms, LCP ${r.lcp} ms, TBT ${r.tbt} ms, CLS ${r.cls?.toFixed?.(3)}${r.tapToPaint != null ? `, tap ${r.tapToPaint} ms` : ''}`,
      ]),
    ),
    failures: summary.rows
      .filter((r) => r.overBudget.length)
      .map((r) => `${r.route}: over budget on ${r.overBudget.join(', ')}`),
    note: `${summary.comparison} ${summary.mockLatencyAdded ? 'The emulated network doesn’t reach the mock’s answers, so each /api/ answer waits 150 ms itself.' : ''} Installed launch: ${summary.installedLaunch}.`,
    details: summary,
  });
  writeJson(checksFile, c);
}

// ---------------------------------------------------------------- questions and coverage

function questions() {
  const d = dump();
  const ws = path.resolve(
    workspace ?? path.join(repoDir, '..', '..', 'ops', 'redesign'),
    '..',
    '..',
  );
  const read = (rel) =>
    existsSync(path.join(ws, rel))
      ? { path: rel, text: readFileSync(path.join(ws, rel), 'utf8') }
      : null;
  const md = (dir) =>
    existsSync(path.join(ws, dir))
      ? readdirSync(path.join(ws, dir))
          .filter((f) => f.endsWith('.md'))
          .map((f) => read(`${dir}/${f}`))
      : [];
  const files = [
    ...md('ops/redesign/reports'),
    ...md('ops/redesign/tasks'),
    read('ops/ui-revamp-review/SPEC.md'),
    read('ops/ui-revamp-review/FEATURES.md'),
    read('HANDOFF.md'),
    read('memory/hmif-ui-revamp.md'),
  ].filter(Boolean);
  const q = buildQuestions({
    openQuestions: read('ops/redesign/OPEN-QUESTIONS.md')?.text ?? '',
    plan: read('ops/redesign/PLAN.md')?.text ?? '',
    files,
    findings: d.findings,
  });
  writeJson(path.join(DATA, 'questions.json'), { createdAt: today, ...q });
  writeJson(path.join(DATA, 'coverage.json'), d.coverage);
  log(
    `questions: ${q.total} items (${q.groups.map((g) => `${g.who} ${g.items.length}`).join(', ')}); coverage: ${d.coverage.length} stories`,
  );
}

// ---------------------------------------------------------------- index

function index() {
  const d = dump();
  // Again, so each flow carries the questions built since it was recorded. Only with the recordings' working state:
  // after clean-up (e2e/.review deleted) the package's flows.json is the record, and rebuilding it would mark every
  // recording "not recorded".
  if (existsSync(STATE)) writeFlowsJson();
  else
    log('index: no e2e/.review/recordings.json; data/flows.json kept as it is');
  const data = {
    release: releaseName(today),
    createdAt: today.slice(0, 16).replace('T', ' '),
    commit: gitHead(),
    areas: d.areas,
    findings: d.findings,
    flows: readJson(path.join(DATA, 'flows.json'), { flows: [] }),
    fidelity: readJson(path.join(DATA, 'fidelity.json'), {
      screens: [],
      summary: {},
    }),
    beforeAfter: readJson(path.join(DATA, 'before-after.json'), {
      pairs: [],
      totals: {},
    }),
    stills: readJson(path.join(DATA, 'stills.json'), {
      stills: [],
      appIcons: [],
    }),
    checks: readJson(path.join(DATA, 'checks.json'), { checks: [] }),
    questions: readJson(path.join(DATA, 'questions.json'), { groups: [] }),
    coverage: readJson(path.join(DATA, 'coverage.json'), d.coverage),
    sizes: readJson(path.join(DATA, 'sizes.json'), {}),
  };
  mkdirSync(path.join(PKG, 'assets'), { recursive: true });
  writeFileSync(path.join(PKG, 'assets', 'review.css'), CSS);
  writeFileSync(path.join(PKG, 'assets', 'review.js'), JS);
  writeFileSync(path.join(PKG, '.gitignore'), 'media/\n');
  const readme = path.join(appDir, 'e2e', 'review', 'README.md');
  if (existsSync(readme)) copyFileSync(readme, path.join(PKG, 'README.md'));
  // The sentinel the page probes for: present when media/ is.
  if (existsSync(MEDIA)) {
    const png = path.join(WORK, 'present.png');
    mkdirSync(WORK, { recursive: true });
    const one = new PNG({ width: 1, height: 1 });
    one.data.fill(255);
    writeFileSync(png, PNG.sync.write(one));
    if (!missingTools().length)
      run(TOOLS.cwebp, webpArgs(png, path.join(MEDIA, 'present.webp')));
  }
  // Sizes per part, measured.
  const partsSize = [
    {
      id: 'recordings-light',
      title: 'Recordings in light',
      bytes: sizeOfMatching(
        path.join(MEDIA, 'flows'),
        /-light(-[a-z0-9-]+)?\.(mp4|webp)$/,
      ),
    },
    {
      id: 'recordings-dark',
      title: 'Recordings in dark',
      bytes: sizeOfMatching(
        path.join(MEDIA, 'flows'),
        /-dark(-[a-z0-9-]+)?\.(mp4|webp)$/,
      ),
    },
    ...PARTS.map((p) => ({
      ...p,
      bytes:
        p.id === 'fidelity'
          ? sizeOf(path.join(MEDIA, 'fidelity'))
          : p.id === 'beforeAfter'
            ? sizeOf(path.join(MEDIA, 'before-after'))
            : p.id === 'stills'
              ? sizeOf(path.join(MEDIA, 'stills'))
              : 0,
    })),
    {
      id: 'traces',
      title: 'Traces of the flows marked test.fail',
      bytes: sizeOf(path.join(MEDIA, 'traces')),
    },
  ];
  const sizes = readJson(path.join(DATA, 'sizes.json'), {});
  writeJson(path.join(DATA, 'sizes.json'), {
    ...sizes,
    parts: partsSize,
    media: sizeOf(MEDIA),
  });
  data.sizes = readJson(path.join(DATA, 'sizes.json'), {});
  const html = buildIndex(data);
  writeFileSync(path.join(PKG, 'index.html'), html);
  const indexPart = partsSize.find((p) => p.id === 'index');
  if (indexPart) {
    indexPart.bytes =
      sizeOf(path.join(PKG, 'assets')) +
      sizeOf(DATA) +
      statSync(path.join(PKG, 'index.html')).size;
    writeJson(path.join(DATA, 'sizes.json'), {
      ...data.sizes,
      parts: partsSize,
      total: sizeOf(PKG),
    });
  }
  log(
    `index: ${path.join(PKG, 'index.html')} (${(statSync(path.join(PKG, 'index.html')).size / 1024).toFixed(0)} KiB); media ${(sizeOf(MEDIA) / MiB).toFixed(1)} MiB`,
  );
}
function sizeOfMatching(dir, re) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory()
      ? sizeOfMatching(p, re)
      : re.test(e.name)
        ? statSync(p).size
        : 0;
  }
  return n;
}

// ---------------------------------------------------------------- run

const STEPS = {
  build,
  pilot,
  ci,
  record,
  fidelity,
  after,
  stills,
  checks,
  lab,
  questions,
  index,
};
mkdirSync(WORK, { recursive: true });
log(
  `package: ${PKG}${only ? `; only ${only}` : ''}; video ${VIDEO ? 'on' : 'off'}; ${os.cpus().length} cores, ${WORKERS} workers`,
);
if (
  parts.some(
    (p) => p !== 'build' && p !== 'questions' && p !== 'index' && p !== 'ci',
  ) &&
  !parts.includes('build') &&
  !existsSync(path.join(appDir, 'e2e', '.build', 'index.html'))
)
  build();
for (const p of parts) {
  log(`— ${p}`);
  STEPS[p]();
}
