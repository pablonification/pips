/**
 * Prints the review's TypeScript data as one JSON object, for scripts/review.mjs (plain Node, which can't import
 * TypeScript): the catalogue, the story coverage, the findings, the checks' names, the stills' sources and states,
 * the app's icons, the swept routes and the hand-checked fidelity notes. Run with tsx: `tsx e2e/review/dump.ts`.
 */
import { CHECKS, COVERAGE } from './coverage';
import { FIDELITY_NOTES } from './fidelity-notes';
import { FINDINGS } from './findings';
import { AREAS, FLOWS, variantLayouts } from './flows';
import { FORWARDING, ROUTES } from './routes';
import { APP_ICONS, OLD_ICONS, STILL_SOURCES, STILL_STATES } from './stills';

const out = {
  areas: AREAS,
  flows: FLOWS.map((f) => ({
    ...f,
    variants: f.variants.map((v) => ({ ...v, layouts: variantLayouts(f, v) })),
  })),
  coverage: COVERAGE,
  checks: CHECKS,
  findings: FINDINGS,
  fidelityNotes: FIDELITY_NOTES,
  stillSources: STILL_SOURCES.map((s) => ({ ...s, parse: undefined })),
  stillStates: STILL_STATES.map(({ id, title, owner, source }) => ({
    id,
    title,
    owner,
    source,
  })),
  appIcons: APP_ICONS,
  oldIcons: OLD_ICONS,
  routes: ROUTES,
  forwarding: FORWARDING,
};
process.stdout.write(JSON.stringify(out));
