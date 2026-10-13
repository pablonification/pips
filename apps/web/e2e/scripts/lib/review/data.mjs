// Pure pieces of `pnpm --filter web review`: turning Playwright's results, the flows' records and the fidelity and
// compare reports into the package's data files. Unit-tested in tests/review-data.test.mjs.
import path from 'node:path';

/** A recording's file name without its extension (flows.ts `recordingName`). @param {{ variants: unknown[] }} flow */
export const recordingName = (
  flow,
  /** @type {string} */ layout,
  /** @type {string} */ theme,
  /** @type {string} */ variant,
) =>
  flow.variants.length > 1
    ? `${layout}-${theme}-${variant}`
    : `${layout}-${theme}`;

/**
 * Every recording a flow makes in one theme: its variants at their layouts.
 * @param {{ id: string, themes: string[], variants: { key: string, who: string, layouts: string[] }[] }} flow
 * @param {string} theme
 */
export function plannedRecordings(flow, theme) {
  if (!flow.themes.includes(theme)) return [];
  return flow.variants.flatMap((v) =>
    v.layouts.map((layout) => ({
      flow: flow.id,
      variant: v.key,
      who: v.who,
      layout,
      theme,
      project: `review-${layout}-${theme}`,
      name: recordingName(flow, layout, theme, v.key),
      file: `media/flows/${flow.id}/${recordingName(flow, layout, theme, v.key)}.mp4`,
      poster: `media/flows/${flow.id}/${recordingName(flow, layout, theme, v.key)}.webp`,
    })),
  );
}

/** The grep that picks one flow's tests (titles end with `@flow:<id>`). @param {string} id */
export const flowGrep = (id) =>
  `@flow:${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;

/**
 * Playwright's JSON report as one row per test run: project, title, status, expected status.
 * @param {any} report
 * @returns {{ project: string, title: string, file: string, status: string, expected: string, duration: number }[]}
 */
export function resultsOf(report) {
  /** @type {{ project: string, title: string, file: string, status: string, expected: string, duration: number }[]} */
  const out = [];
  /** @param {any} suite @param {string[]} titles @param {string} file */
  const walk = (suite, titles, file) => {
    const where = suite.file ?? file;
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? []) {
        const last = (t.results ?? []).at(-1);
        out.push({
          project: t.projectName,
          title: [...titles, spec.title].filter(Boolean).join(' › '),
          file: spec.file ?? where ?? '',
          status: last?.status ?? 'skipped',
          expected: t.expectedStatus ?? 'passed',
          duration: last?.duration ?? 0,
        });
      }
    for (const s of suite.suites ?? []) walk(s, [...titles, s.title], where);
  };
  for (const s of report.suites ?? []) walk(s, [], '');
  return out;
}

/** Counts per project: passed, failed, flaky, skipped, expected failures. @param {ReturnType<typeof resultsOf>} rows */
export function countsByProject(rows) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  for (const r of rows) {
    const c = (out[r.project] ??= {
      passed: 0,
      failed: 0,
      skipped: 0,
      'expected failures': 0,
    });
    if (r.status === 'skipped') c.skipped++;
    else if (r.expected === 'failed' && r.status === 'failed')
      c['expected failures']++;
    else if (r.status === r.expected) c.passed++;
    else c.failed++;
  }
  return out;
}

/**
 * A recording's result from its Playwright row: passed, failed, a known failure, or not recorded.
 * @param {{ status: string, expected: string } | undefined} row
 */
export function recordingStatus(row) {
  if (!row || row.status === 'skipped') return 'not recorded';
  if (row.expected === 'failed')
    return row.status === 'failed' ? 'expected-failure' : 'failed';
  return row.status === 'passed' ? 'passed' : 'failed';
}

/** The flow and variant in a test title: "… [beranda:nadia] @flow:beranda". @param {string} title */
export function flowOfTitle(title) {
  const m = /\[([a-z0-9-]+):([a-z0-9-]+)\] @flow:/.exec(title);
  return m ? { flow: m[1], variant: m[2] } : null;
}

/**
 * Who built a locked screen (F1 brief, "Owned locked screens").
 * @param {string} name e.g. `phone-anggota-beranda-light`, `i-palette`, `page-phone-light`
 */
export function ownerOfScreen(name) {
  const key = name
    .replace(/^(phone|tablet|desk)-/, '')
    .replace(/-(light|dark)$/, '');
  if (/^system-(kit|cards)$/.test(key)) return 'P0-A';
  if (/^page-|^narrow320-beranda$|^desk1024-beranda$/.test(key))
    return 'P0-C and P1-A';
  /** @type {[RegExp, string][]} */
  const table = [
    [
      /^(anggota|pengurus)-(beranda|kalender)$|^anggota-ov-event$|^i-(event-sheet|tablet-sheet|palette|palette-phone)$/,
      'P1-A',
    ],
    [
      /^(anggota|pengurus)-pengumuman$|^anggota-(post|tulis|ov-filter|pop-react|pop-menu)$|^pengurus-pop-menu-own$|^i-(feed-reacted|post-detail|filter-sheet|compose-anggota|desk-own-menu)$/,
      'P1-B',
    ],
    [
      /^(anggota|pengurus)-(profil|layanan)$|^anggota-(matkul|matkul-add|notif|ov-push)$|^i-(matkul-add|push-dialog)$/,
      'P1-C',
    ],
    [/^anggota-(form|fill)$|^pengurus-form-empty$|^i-form-/, 'P2-A'],
    [/^anggota-(dingdong|testi-list|testi-course|nim|lomba)$|^i-testi/, 'P2-B'],
    [/^anggota-(curhat|room)$|^pengurus-curhat-empty$|^i-curhat-room$/, 'P2-C'],
    [/^pengurus-(kelola|live)$|^i-desk-live$/, 'P3-A'],
    [/^pengurus-ov-addev$|^i-desk-(addev|kalender-after)$/, 'P3-B'],
  ];
  // The confirmation sheet: P1-C on phones and tablets (sign-out), P2-A on desktop (send the form).
  if (key === 'anggota-ov-confirm')
    return name.startsWith('desk-') ? 'P2-A' : 'P1-C';
  for (const [re, owner] of table) if (re.test(key)) return owner;
  return 'unknown';
}

/**
 * The reason a task's report gives for a screen that differs: the first item of its "Deviations" sections that names
 * the screen (its key, `anggota-beranda`, or its interaction id, `i-palette`). None: the screen is unexplained.
 * @param {string} name @param {{ text: string, kind: string, source: { file: string } }[]} items the report items
 */
export function deviationFor(name, items) {
  const key = name
    .replace(/^(phone|tablet|desk)-/, '')
    .replace(/-(light|dark)$/, '');
  const route = key.replace(/^(anggota|pengurus)-/, '');
  const hit = items.find(
    (i) =>
      (i.kind === 'deviation' || i.kind === 'for-owner') &&
      (i.text.includes(key) ||
        (new RegExp(`\\b${route.replace(/[-]/g, '[- ]')}\\b`, 'i').test(
          i.text,
        ) &&
          route.length > 5)),
  );
  return hit ? `${hit.text} (${path.basename(hit.source.file)})` : null;
}

/** The median of the numbers given, ignoring nulls. @param {(number | null | undefined)[]} xs */
export function median(xs) {
  const v = /** @type {number[]} */ (
    xs.filter((x) => typeof x === 'number' && Number.isFinite(x))
  ).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** SPEC's lab budgets (SPEC "Performance architecture and budgets"), in ms, KiB or as a number. */
export const LAB_BUDGETS = {
  fcp: 2500,
  lcp: 4000,
  tbt: 300,
  longestTask: 250,
  tapToPaint: 200,
  cls: 0.05,
  berandaKib: 450,
  berandaRequests: 15,
};
/** Today's app on the old server against live staging (ops/ui-revamp-review/reports/performance.md, phone, medians). */
export const TODAY = {
  login: {
    fcp: 7700,
    lcp: 7700,
    cls: 0,
    tbt: 104,
    longestTask: 2245,
    requests: 11,
    kib: 867,
  },
  beranda: {
    fcp: 6600,
    lcp: 10500,
    cls: 0.01,
    tbt: 1241,
    longestTask: 2159,
    requests: 21,
    kib: 1231,
  },
  pengumuman: {
    fcp: 6900,
    lcp: 8100,
    cls: 0.003,
    tbt: 870,
    longestTask: 2123,
    requests: 10,
    kib: 724,
  },
  kalender: {
    fcp: 6700,
    lcp: 8200,
    cls: 0.002,
    tbt: 1319,
    longestTask: 2124,
    requests: 12,
    kib: 724,
  },
  layanan: null,
  tapToPaint: 712,
};

/**
 * The lab runs (JSON lines) as medians per route, against SPEC's budgets and today's numbers.
 * @param {any[]} lines
 */
export function labSummary(lines) {
  const probe = lines.find((l) => l.kind === 'probe') ?? null;
  const runs = lines.filter((l) => l.kind === 'run');
  const routes = [...new Set(runs.map((r) => r.route))];
  const rows = routes.map((route) => {
    const mine = runs.filter((r) => r.route === route);
    /** @param {string} k */
    const m = (k) => median(mine.map((r) => r[k]));
    const row = {
      route,
      runs: mine.length,
      fcp: m('fcp'),
      lcp: m('lcp'),
      cls: m('cls'),
      tbt: m('tbt'),
      longestTask: m('longestTask'),
      tapToPaint: m('tapToPaint'),
      requestsBeforeContent: m('requestsBeforeContent'),
      kibBeforeContent: m('kibBeforeContent'),
      today: /** @type {Record<string, any>} */ (TODAY)[route] ?? null,
    };
    /** @type {string[]} */
    const over = [];
    if (row.fcp != null && row.fcp > LAB_BUDGETS.fcp) over.push('FCP');
    if (row.lcp != null && row.lcp > LAB_BUDGETS.lcp) over.push('LCP');
    if (row.tbt != null && row.tbt > LAB_BUDGETS.tbt) over.push('TBT');
    if (row.longestTask != null && row.longestTask > LAB_BUDGETS.longestTask)
      over.push('longest task');
    if (row.cls != null && row.cls > LAB_BUDGETS.cls) over.push('CLS');
    if (row.tapToPaint != null && row.tapToPaint > LAB_BUDGETS.tapToPaint)
      over.push('tap to paint');
    if (
      route === 'beranda' &&
      row.requestsBeforeContent != null &&
      row.requestsBeforeContent > LAB_BUDGETS.berandaRequests
    )
      over.push('requests before content');
    return { ...row, overBudget: over };
  });
  return {
    profile:
      '390 × 844, CPU 4× slower, 1.6 Mbps down, 750 kbps up, 150 ms; a cold cache; median of 3 runs',
    throttleReachesMock: probe ? probe.reaches : null,
    mockLatencyAdded: probe ? !probe.reaches : null,
    installedLaunch:
      'not measured: the harness blocks service workers and its mock doesn’t answer a service worker’s own requests',
    comparison:
      'Today’s numbers were measured on the old server against the live staging API (performance.md, 2026-10-08), so the comparison is indicative, not like for like.',
    rows,
  };
}

/** Which flows show each before-set state (for the flow pages' before-and-after pairs). */
export const STATE_FLOWS = /** @type {Record<string, string[]>} */ ({
  login: ['signin-refused', 'signin-shared-link'],
  'install-prompt': ['phone-browser'],
  'app-loading': ['session-hiccup'],
  home: ['beranda', 'navigation'],
  'home-pengurus': ['beranda-pengurus'],
  'home-schedule-loading': ['beranda'],
  'home-other-day': ['beranda'],
  timeline: ['pengumuman-unread'],
  'timeline-loading': ['errors-offline'],
  'timeline-error': ['errors-offline'],
  'timeline-empty': ['pengumuman-filter'],
  'timeline-offline': ['errors-offline'],
  'timeline-unread': ['pengumuman-unread'],
  'timeline-filter': ['pengumuman-filter'],
  'timeline-card-menu': ['pengumuman-unread'],
  post: ['pengumuman-unread'],
  'post-reactions': ['pengumuman-react-comment'],
  composer: ['tulis-anggota'],
  'composer-categories': ['tulis-anggota', 'tulis-pengurus'],
  calendar: ['kalender'],
  'calendar-pengurus': ['kalender-tambah-acara'],
  'calendar-add-event': ['kalender-tambah-acara'],
  dingdong: ['dingdong'],
  'nim-finder': ['nim-finder'],
  'nim-finder-results': ['nim-finder'],
  competition: ['info-lomba'],
  'testi-programs': ['testi-browse'],
  'testi-courses': ['testi-browse'],
  'testi-course': ['testi-browse'],
  curhat: ['curhat-start'],
  'curhat-room': ['curhat-room'],
  'curhat-empty': ['curhat-start'],
  'form-list': ['form-list'],
  'form-empty': ['form-list'],
  'form-step-1': ['form-pixel'],
  'form-step-2': ['form-pixel'],
  'form-step-3': ['form-pixel'],
  'form-step-4': ['form-pixel'],
  'form-step-5': ['form-pixel'],
  'form-required': ['form-pixel'],
  'form-confirm': ['form-pixel'],
  'form-done': ['form-pixel'],
  settings: ['profil'],
  'settings-courses': ['matkul'],
  'settings-courses-add': ['matkul'],
  'settings-notifications': ['notifikasi'],
  'settings-credits': ['profil'],
  admin: ['kelola'],
  'admin-forms': ['live-counting'],
  'admin-live': ['live-counting'],
  'sparta-table': ['sparta-data'],
  'sparta-submission': ['sparta-data'],
});
/** Before-set states removed by design, with the reason (SPEC "Removals"). */
export const REMOVED = /** @type {Record<string, string>} */ ({
  'install-prompt':
    'Removed by design (SPEC "Removals"): a phone browser now opens the app itself instead of an install tutorial.',
});

/** The release file for the media, from the package's date. @param {string} isoDate */
export const releaseName = (isoDate) => `review-${isoDate.slice(0, 10)}.zip`;
