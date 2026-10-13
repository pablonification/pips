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
}

/** Where a finding fails its flows: every recording, or only these layouts or themes. */
export interface FailsWhere {
  layouts?: string[];
  themes?: string[];
}

export const FINDINGS: Finding[] = [
  {
    id: 'F1-1',
    title: 'Global search with no result fails axe: an element that needs children of a given role has none',
    flows: ['search'],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['light', 'dark'],
    detail:
      'Search for "zzzz": "Tidak ada hasil untuk “zzzz”." shows, and axe reports aria-required-children (critical) on the search dialog (#radix-…), the list of results left with no option. Strict gates fail. The journeys never audited the empty result (shell.spec.ts audits the start list only).',
    owner: 'P1-A',
  },
  {
    id: 'F1-2',
    title: 'In dark, the error page of a page that failed to load fails contrast: its "Ke Beranda" button',
    flows: ['errors-offline'],
    layouts: ['phone', 'tablet', 'desktop'],
    themes: ['dark'],
    detail:
      'When a page\'s code fails to load, the shell shows "Bagian ini gagal dimuat." with Coba lagi and Ke Beranda (src/components/error-fallback.tsx, RouteErrorFallback). It is built from today\'s Button (components/ui/button.tsx, variant "outlined"), not Garis components, and in dark axe reports color-contrast (serious) on the outlined Ke Beranda button (.border). Light passes. No journey reaches this state. C1 may touch the old Button; check again after C1.',
    owner: 'P0-B',
  },
];

export const findingById = (id: string) => {
  const f = FINDINGS.find((x) => x.id === id);
  if (!f) throw new Error(`No finding ${id} in e2e/review/findings.ts`);
  return f;
};

/** The `test.fail` description for a flow that shows a finding: "F1-1: …". */
export const failsWith = (id: string) => `${id}: ${findingById(id).title}`;
