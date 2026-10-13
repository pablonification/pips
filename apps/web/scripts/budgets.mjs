// Checks a production build against the performance budgets (SPEC "Performance architecture and budgets"):
// per-route first-party JS before first render (≤ 150 KiB gzip; the 120 KiB stretch is reported), the service
// worker's precache (≤ 1.5 MiB) and the fonts (exactly two files, Geist ≤ 50 KiB, Archivo Expanded ≤ 30 KiB).
//   pnpm --filter web build && pnpm --filter web budgets            # strict since C1: exits 1 over budget
//   BUDGETS_STRICT=0 pnpm --filter web budgets                       # warn mode: prints, exits 0
//   pnpm --filter web budgets --json out.json                        # also writes the numbers and each route's packages
import fs from 'node:fs';
import path from 'node:path';
import { BUDGETS, KIB, measureBuild, overBudget } from './lib/budgets.mjs';

const dist = path.resolve(import.meta.dirname, '../dist');
if (!fs.existsSync(path.join(dist, '.vite/manifest.json'))) {
  console.error(
    'budgets: no build in apps/web/dist; run `pnpm --filter web build` first',
  );
  process.exit(2);
}
const result = measureBuild(dist);
const kib = (n) => `${(n / KIB).toFixed(1)} KiB`;

console.log('First-party JS before first render, per route (gzip):');
for (const r of [...result.routes].sort((a, b) => b.gzip - a.gzip)) {
  const flag =
    r.gzip > BUDGETS.routeInitialJsGzip
      ? '  over'
      : r.gzip > BUDGETS.routeInitialJsGzipStretch
        ? '  over the 120 KiB stretch'
        : '';
  console.log(`  ${kib(r.gzip).padStart(10)}  ${r.route}${flag}`);
}
console.log(
  `Precache: ${result.precache.length} files, ${kib(result.precacheBytes)} (budget ${kib(BUDGETS.precache)})`,
);
for (const p of [...result.precache]
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10)) {
  console.log(`  ${kib(p.bytes).padStart(10)}  ${p.url}`);
}

console.log('Fonts:');
for (const f of result.fonts)
  console.log(`  ${kib(f.bytes).padStart(10)}  ${f.file}`);

const jsonAt = process.argv.indexOf('--json');
if (jsonAt !== -1)
  fs.writeFileSync(
    process.argv[jsonAt + 1],
    `${JSON.stringify(result, null, 2)}\n`,
  );

const problems = overBudget(result);
if (problems.length) {
  const strict = process.env.BUDGETS_STRICT !== '0';
  console.log(
    `\n${strict ? 'Over budget' : 'Warning, over budget (BUDGETS_STRICT=0)'}:`,
  );
  problems.forEach((p) => console.log(`  ${p}`));
  if (strict) process.exit(1);
} else {
  console.log('\nAll within budget.');
}
