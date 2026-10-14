// The CI steps the review's checks re-run (F1 brief, step 8): every step `.github/workflows/check.yml` runs after
// "Production build", in that job only. Other jobs (the Docker images, the e2e shards) need Docker or CI's matrix
// and are reported from GitHub instead. Pure, unit-tested (tests/review-ci.test.mjs).

/**
 * The `name` and one-line `run` of each step after "Production build", up to the end of its job.
 * @param {string} yaml check.yml's text
 * @returns {{ name: string, run: string }[]}
 */
export function ciStepsAfterBuild(yaml) {
  const lines = yaml.split('\n');
  const at = lines.findIndex((l) => /^\s*- name: Production build\s*$/.test(l));
  if (at < 0) return [];
  /** @type {{ name: string, run: string }[]} */
  const steps = [];
  /** @type {{ name: string, run: string | null } | null} */
  let step = null;
  for (const line of lines.slice(at + 1)) {
    // The next job starts at two spaces of indent (`  docker:`); `jobs:` itself is at none.
    if (/^ {0,2}[A-Za-z0-9_-]+:\s*$/.test(line)) break;
    const name = /^\s*- name: (.+)$/.exec(line);
    if (name) {
      if (step?.run) steps.push({ name: step.name, run: step.run });
      step = { name: name[1].trim(), run: null };
      continue;
    }
    const run = /^\s+run: (.+)$/.exec(line);
    if (step && run && !step.run && run[1].trim() !== '|')
      step.run = run[1].trim();
  }
  if (step?.run)
    steps.push(/** @type {{ name: string, run: string }} */ (step));
  return steps;
}
