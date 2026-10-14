/**
 * F1's own findings: problems in the app that the flows show, for F2 (F1 brief, "Done when"). F1 changes no app
 * code, so each flow that shows one stays failing (`test.fail` with the finding's id) and keeps its trace, copied to
 * `media/traces/<id>.zip` by `pnpm --filter web review record`. F2 fixes the bug and removes the marker.
 */
export interface Finding {
  id: string;
  /** One line: what is wrong, as the owner would see it. */
  title: string;
  /** The flows marked `test.fail` for it (none when only a still or a check shows it). */
  flows: string[];
  layouts: string[];
  themes: string[];
  /** What was measured, and where. */
  detail: string;
  /** The task that owns the screen. */
  owner: string;
  security?: boolean;
  /** Set when a later merge fixed it: what fixed it. The finding stays listed, shown as fixed, not as a blocker. */
  fixed?: string;
}

/** Where a finding fails its flows: every recording, or only these layouts or themes. */
export interface FailsWhere {
  layouts?: string[];
  themes?: string[];
}

export const FINDINGS: Finding[] = [
  {
    id: 'F1-1',
    title:
      'Global search with no result fails axe: an element that needs children of a given role has none',
    flows: ['search'],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'Search for "zzzz": "Tidak ada hasil untuk “zzzz”." shows, and axe reports aria-required-children (critical) on the search dialog (#radix-…), the list of results left with no option. Strict gates fail. The journeys never audited the empty result (shell.spec.ts audits the start list only).',
    owner: 'P1-A',
  },
  {
    id: 'F1-2',
    title:
      'In dark, the error page of a page that failed to load fails contrast: its "Ke Beranda" button',
    flows: [],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['dark'],
    detail:
      'Found in part 1 on 6bbbbd8: when a page\'s code fails to load, the shell shows "Bagian ini gagal dimuat." with Coba lagi and Ke Beranda (src/components/error-fallback.tsx, RouteErrorFallback), then built from today\'s Button; in dark, axe reported color-contrast (serious) on the outlined Ke Beranda. The flow errors-offline carried test.fail in dark.',
    owner: 'P0-B',
    fixed:
      'Fixed by C1 (fc60b01, merged into redesign as 5a23c22): the fallbacks use the Garis Button. After the merge the dark errors-offline flow passed its strict audit, so its test.fail marker was removed (part 2).',
  },
  {
    id: 'F1-3',
    title:
      'Every route loads 196–222 KiB of JavaScript before its first render, over SPEC’s 150 KiB budget',
    flows: [],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'BUDGETS_STRICT=1 pnpm --filter web budgets fails on every route (/login 197.1 KiB, / 212.4, /pengumuman 222.2 KiB gzip; C1 report, "Bundle sizes"). Most of it is the shared entry chunk: react-dom 62 KiB, the router 26, Radix with Floating UI about 26, zod 12.5, React Query 11.7, tailwind-merge 8.3. CI runs the budgets in warn mode (BUDGETS_STRICT=0) because of it. The checks page has the per-route numbers.',
    owner: 'P0-B (the budgets); every task shares the entry chunk',
  },
  {
    id: 'F1-4',
    title:
      'While the session first loads, the app shows the English word "Loading..."',
    flows: [],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'src/components/session.tsx:78 renders <div>Loading...</div> (a "TODO: loading UI" from P0-B) when no member is cached and GET /api/me hasn’t answered: English, unstyled, outside the copy catalogue (src/copy/). The before-and-after state app-loading shows it.',
    owner: 'P0-B',
  },
  {
    id: 'F1-5',
    title:
      'Two screens render a title or a button twice and hide one copy with CSS',
    flows: [],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'src/features/layanan/LayananScreen.tsx:48 renders PageTitle with className "lg:hidden" beside DeskHead’s title; src/features/testi/TestiScreens.tsx:477 renders Tambah testimoni in a "lg:hidden" wrapper beside the page actions. SPEC asks for one responsive tree; the hidden-DOM budget still passes (C1 report, Needs Dev 1 item 4).',
    owner: 'P1-C (Layanan), P3-B (Tambah testimoni)',
  },
  {
    id: 'F1-6',
    title:
      'The programme-window API (SPEC API change 1) has no caller in the web app',
    flows: [],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'GET /api/programme-windows exists (apps/api/src/routes/programme-window.route.ts, P1-A) and only the generated client mentions it (src/api/generated/services/ProgrammeWindowService.ts); no screen reads it, and C1 dropped its unused mock handler. If Beranda or Layanan should show programme windows from it (SPEC story 151), that is a P1-A follow-up (C1 report, Needs Dev 1 item 5).',
    owner: 'P1-A',
  },
];

export const findingById = (id: string) => {
  const f = FINDINGS.find((x) => x.id === id);
  if (!f) throw new Error(`No finding ${id} in e2e/review/findings.ts`);
  return f;
};

/** The `test.fail` description for a flow that shows a finding: "F1-1: …". */
export const failsWith = (id: string) => `${id}: ${findingById(id).title}`;
