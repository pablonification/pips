// The package's size budget (F1 brief, "Size budget (measure first)"). Pure functions, unit-tested
// (tests/review-budget.test.mjs): the budget from the day's free space, the projection from the pilot, and the order
// in which recordings are added while they fit.
export const MiB = 1024 * 1024;
export const GiB = 1024 * MiB;

export const BUDGET = {
  /** The disk guard's floor: never go below it. */
  floor: 1 * GiB,
  /** A production build, one flow's raw WebM, one full-resolution fidelity run, the after set. */
  workingPeak: 250 * MiB,
  margin: 100 * MiB,
  cap: 300 * MiB,
  /** Below this, stop before recording and ask Dev 1 to free space (light recordings plus the rest). */
  minimum: 210 * MiB,
};

/** The parts after the light recordings, in priority order, with their ceilings. */
export const PARTS = [
  { id: 'fidelity', title: 'Prototype versus app', max: 40 * MiB },
  { id: 'beforeAfter', title: 'Before and after', max: 25 * MiB },
  { id: 'stills', title: 'Screens with no locked target and the proposals', max: 10 * MiB },
  { id: 'index', title: 'Index, data, posters, assets', max: 5 * MiB },
];

/** Measured on this Mac at CRF 32, 25 fps (F1 brief): kilobytes per second of video, per layout. @type {Record<string, number>} */
export const MEASURED_KBPS = { phone: 15, tablet: 21, desktop: 28, narrow320: 15 };
/** Measured: about 0.83 × the size for each 2 CRF steps up (CRF 28 → 32 was about 0.7). */
export const SIZE_PER_CRF_STEP = 0.83;

/**
 * The package budget for `freeBytes` free: free − floor − working peak − margin, capped. Never negative.
 * @param {number} freeBytes
 */
export function packageBudget(freeBytes, b = BUDGET) {
  return Math.max(0, Math.min(b.cap, freeBytes - b.floor - b.workingPeak - b.margin));
}

/** What the other parts may take at most. */
export const otherParts = (parts = PARTS) => parts.reduce((n, p) => n + p.max, 0);

/**
 * The projected bytes of a set of recordings.
 * @param {{ layout: string, seconds: number }[]} recordings
 * @param {Record<string, number>} kbps kilobytes per second per layout
 * @param {number} crf
 */
export function projectBytes(recordings, kbps = MEASURED_KBPS, crf = 32) {
  const scale = SIZE_PER_CRF_STEP ** ((crf - 32) / 2);
  return Math.round(
    recordings.reduce((n, r) => n + r.seconds * (kbps[r.layout] ?? kbps.desktop) * 1024 * scale, 0),
  );
}

/**
 * From a pilot's measured recordings, kilobytes per second per layout and the mean seconds per recording.
 * @param {{ layout: string, seconds: number, bytes: number }[]} pilot
 */
export function fromPilot(pilot) {
  /** @type {Record<string, { s: number, b: number }>} */
  const by = {};
  for (const r of pilot) {
    by[r.layout] ??= { s: 0, b: 0 };
    by[r.layout].s += r.seconds;
    by[r.layout].b += r.bytes;
  }
  /** @type {Record<string, number>} */
  const kbps = { ...MEASURED_KBPS };
  for (const [layout, { s, b }] of Object.entries(by)) if (s > 0) kbps[layout] = b / 1024 / s;
  if (kbps.phone && !by.narrow320) kbps.narrow320 = kbps.phone;
  const seconds = pilot.length ? pilot.reduce((n, r) => n + r.seconds, 0) / pilot.length : 40;
  return { kbps, secondsPerRecording: seconds };
}

/**
 * Which recordings to make: light for every flow, then the dark set, then dark for every flow, as long as the
 * projection stays within the budget. If light alone doesn't fit, raise the CRF by 2 up to 34; still not: stop.
 * @param {{ budget: number, light: { layout: string, seconds: number }[], darkSet: { layout: string, seconds: number }[],
 *   darkRest: { layout: string, seconds: number }[], kbps?: Record<string, number>, others?: number }} o
 * @returns {{ ok: boolean, crf: number | null, phases: string[], projected: number, reason: string }}
 */
export function planRecordings({ budget, light, darkSet, darkRest, kbps = MEASURED_KBPS, others = otherParts() }) {
  if (budget < BUDGET.minimum)
    return {
      ok: false,
      crf: null,
      phases: [],
      projected: 0,
      reason: `the budget (${(budget / MiB).toFixed(0)} MiB) is under ${BUDGET.minimum / MiB} MiB: ask Dev 1 to free space before recording`,
    };
  for (const crf of [32, 34]) {
    let used = others + projectBytes(light, kbps, crf);
    if (used > budget) continue;
    const phases = ['light'];
    const set = projectBytes(darkSet, kbps, crf);
    if (used + set <= budget) {
      used += set;
      phases.push('dark-set');
      const rest = projectBytes(darkRest, kbps, crf);
      if (used + rest <= budget) {
        used += rest;
        phases.push('dark-rest');
      }
    }
    return { ok: true, crf, phases, projected: used, reason: crf === 32 ? '' : 'light fits only at CRF 34' };
  }
  return {
    ok: false,
    crf: null,
    phases: [],
    projected: others + projectBytes(light, kbps, 34),
    reason: 'light recordings don’t fit even at CRF 34: stop and report',
  };
}
