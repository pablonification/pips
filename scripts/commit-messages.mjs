// Conventional Commits check for pull requests (the owner's rule from 2026-10-13, 06:45 WIB).
//   node scripts/commit-messages.mjs <base> [head]
// Checks the first line of every commit in base..head committed after the rule started; older commits are
// history and stay as they are. The same pattern is in the workspace's commit-msg hook
// (ops/redesign/hooks/commit-msg in pips-workspace).
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RULE_START = Date.parse('2026-10-13T06:45:00+07:00');
export const MAX_HEADER = 100;
const PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9./-]*(,[a-z0-9][a-z0-9./-]*)*\))?!?: \S.*$/;

/** Why a commit's first line isn't a Conventional Commit, or null when it is. */
export function headerProblem(header) {
  if (!PATTERN.test(header)) return 'not "type(scope): summary"';
  if (header.length > MAX_HEADER) return `longer than ${MAX_HEADER} characters`;
  return null;
}

function main() {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) {
    console.error('usage: node scripts/commit-messages.mjs <base> [head]');
    process.exit(2);
  }
  const log = execFileSync('git', ['log', '--format=%H%x09%ct%x09%s', `${base}..${head}`], {
    encoding: 'utf8',
  });
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, time, ...rest] = line.split('\t');
      return { sha, time: Number(time) * 1000, header: rest.join('\t') };
    })
    .filter((c) => c.time >= RULE_START);
  const bad = commits
    .map((c) => ({ ...c, problem: headerProblem(c.header) }))
    .filter((c) => c.problem);
  for (const c of bad) console.error(`${c.sha.slice(0, 7)}  ${c.problem}: ${c.header}`);
  console.log(`${commits.length} commit(s) checked, ${bad.length} not conventional.`);
  process.exit(bad.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
