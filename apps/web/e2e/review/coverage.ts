/**
 * SPEC's 157 user stories and where the review package shows each (F1 brief, step 11). Every story is one of:
 * - shown: the flows whose recordings show it (taken from the catalogue's `stories`, so they can't drift apart);
 * - checked: a check proves it (budgets, the sweep, the token tests, …), sometimes with flows too;
 * - not built: why, with its source;
 * - out of scope: SPEC "Out of Scope".
 * A story the catalogue shows but that was only partly built keeps "shown", with what's missing in `reason`.
 */
import { FLOWS } from './flows';

export type CoverageStatus = 'shown' | 'checked' | 'not built' | 'out of scope';

/** The checks in data/checks.json a story can point at (step 8). */
export const CHECKS = {
  repo: 'Repository checks: type check, lint, unit tests, builds (pnpm check, test, build)',
  bundle: 'The production bundle, precache and service-worker checks',
  journeys: 'The whole journey suite, strict gates',
  sweep: 'The sweep: every route at 320, 390, 768, 1024, 1440 px and 200 % zoom, light and dark',
  contrast: 'Contrast: the token tests and axe’s colour-contrast results',
  budgets: 'Budgets: JS before first render per route, precache, fonts; Beranda’s first load, CLS, hidden DOM',
  lab: 'Lab speed on SPEC’s lab phone (FCP, LCP, CLS, TBT, tap to paint)',
  visual: 'Visual references (e2e/visual), on the Mac and in CI',
  fidelity: 'Prototype versus app (every locked screen)',
  beforeAfter: 'Before and after (the 200 captures of today’s app)',
  stills: 'Screens with no locked target, and the app’s icons',
  people: 'Screen readers (TalkBack, VoiceOver, NVDA) and the usability test: need a person',
} as const;
export type CheckId = keyof typeof CHECKS;

export interface CoverageRow {
  story: number;
  status: CoverageStatus;
  flows: string[];
  checks: CheckId[];
  /** Why it isn't built or out of scope, or what of it is missing; with its source. */
  reason?: string;
}

/** Stories decided by something other than the catalogue: not built, out of scope, checked, or partly built. */
const NOTES: Record<number, Omit<CoverageRow, 'story' | 'flows'> & { flows?: string[] }> = {
  6: { status: 'shown', checks: [] },
  35: {
    status: 'not built',
    checks: [],
    reason: 'Campaign banners: no locked design (P1-A brief, "Not in this task"; OPEN-QUESTIONS D5).',
  },
  36: {
    status: 'not built',
    checks: [],
    reason: 'Testi Matkul during course registration: no locked design (P1-A brief, "Not in this task"; D5).',
  },
  37: {
    status: 'not built',
    checks: [],
    reason: 'UTS and UAS standing out: no locked design (P1-A brief, "Not in this task"; D5).',
  },
  38: {
    status: 'shown',
    checks: [],
    reason: 'The admin’s live count is built; Welfare’s line in the Kelola summary is not (P1-A report; D5).',
  },
  50: {
    status: 'not built',
    checks: [],
    reason: 'The composer has no autosaved draft (P1-B report; OPEN-QUESTIONS A5).',
  },
  53: {
    status: 'shown',
    checks: [],
    reason: 'Umumkan ulang has no confirmation step (P1-B report; A5).',
  },
  62: {
    status: 'out of scope',
    checks: [],
    reason: 'Campus labels need a backend field (SPEC "Out of Scope": the campus field; P1-A brief).',
  },
  68: {
    status: 'not built',
    checks: [],
    reason: '"Masuk dengan email std ITB" on services: not in the prototype (P1-C report, open question 8).',
  },
  69: {
    status: 'not built',
    checks: [],
    reason: 'Pinning and reordering services: not in the prototype (P1-A brief; P1-C report, open question 8).',
  },
  74: {
    status: 'shown',
    checks: [],
    reason: 'Only the Akademik line; how to contribute isn’t described (D6).',
  },
  75: { status: 'shown', checks: [], reason: 'No recent searches (D6).' },
  77: { status: 'shown', checks: [], reason: 'No posters (D6).' },
  95: {
    status: 'not built',
    checks: [],
    reason: 'Crisis help waits on HMIF Welfare’s wording and contacts (P2-C brief; SPEC "Still open").',
  },
  100: { status: 'shown', checks: [], reason: 'No labels (P3-C report; D9).' },
  105: { status: 'shown', checks: [], reason: 'The test notification is local; no server push (A4).' },
  112: { status: 'shown', checks: [], reason: 'Editing the course catalogue isn’t built (A10).' },
  118: {
    status: 'checked',
    checks: ['repo', 'journeys'],
    flows: ['tulis-anggota', 'tulis-pengurus'],
    reason: 'Already data (categories.roles_allowed), honoured by the API and the composer; no admin screen (P3-A brief).',
  },
  120: { status: 'checked', checks: ['fidelity', 'sweep'] },
  121: { status: 'checked', checks: ['fidelity', 'stills'], flows: ['profil'] },
  122: { status: 'checked', checks: ['fidelity'] },
  123: { status: 'checked', checks: ['fidelity'] },
  124: { status: 'checked', checks: ['repo', 'fidelity'] },
  129: { status: 'checked', checks: ['budgets'] },
  130: { status: 'checked', checks: ['lab', 'budgets'] },
  131: { status: 'checked', checks: ['lab'] },
  132: { status: 'checked', checks: ['lab'] },
  133: { status: 'checked', checks: ['budgets'] },
  137: {
    status: 'not built',
    checks: [],
    reason: 'No brief or report covers images sized for the screen in modern formats; F2 to confirm.',
  },
  138: { status: 'checked', checks: ['bundle'] },
  139: { status: 'checked', checks: ['journeys', 'sweep', 'people'] },
  140: { status: 'checked', checks: ['journeys', 'sweep'] },
  143: { status: 'checked', checks: ['journeys', 'people'] },
  144: { status: 'checked', checks: ['sweep'] },
  145: { status: 'checked', checks: ['sweep', 'contrast'] },
  146: { status: 'checked', checks: ['sweep'] },
  147: { status: 'checked', checks: ['sweep'] },
  148: { status: 'checked', checks: ['contrast', 'repo'] },
  149: { status: 'checked', checks: ['repo'] },
  150: { status: 'checked', checks: ['repo'] },
  151: { status: 'checked', checks: ['repo'] },
  152: { status: 'checked', checks: ['repo'] },
  153: { status: 'checked', checks: ['journeys'] },
  154: { status: 'checked', checks: ['budgets'] },
  155: { status: 'checked', checks: ['repo'] },
  156: { status: 'checked', checks: ['beforeAfter'] },
  157: { status: 'checked', checks: ['visual'] },
};

/** One row per story, 1 to 157. */
export function coverage(): CoverageRow[] {
  return Array.from({ length: 157 }, (_, i) => {
    const story = i + 1;
    const flows = FLOWS.filter((f) => f.stories.includes(story)).map((f) => f.id);
    const note = NOTES[story];
    if (note)
      return {
        story,
        status: note.status,
        flows: [...new Set([...(note.flows ?? []), ...(note.status === 'not built' || note.status === 'out of scope' ? [] : flows)])],
        checks: note.checks,
        ...(note.reason ? { reason: note.reason } : {}),
      };
    return flows.length
      ? { story, status: 'shown' as const, flows, checks: [] }
      : {
          story,
          status: 'not built' as const,
          flows: [],
          checks: [],
          reason: 'No flow shows it and no check proves it: F1 to add one (unit test review-coverage fails).',
        };
  });
}

export const COVERAGE = coverage();
