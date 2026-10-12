// Runs Playwright with the harness config from apps/web, passing extra command-line arguments through.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { appDir } from './paths.mjs';

/** @param {string[]} projects @param {Record<string, string>} env @returns {number} exit code */
export function playwright(projects, env, extra = process.argv.slice(2)) {
  const args = [
    'test',
    '-c',
    'e2e',
    ...projects.map((p) => `--project=${p}`),
    ...extra,
  ];
  const r = spawnSync(
    path.join(appDir, 'node_modules', '.bin', 'playwright'),
    args,
    { cwd: appDir, stdio: 'inherit', env: { ...process.env, ...env } },
  );
  return r.status ?? 1;
}

/** The current commit of the app, for the records. */
export function gitHead() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: appDir,
    encoding: 'utf8',
  });
  const dirty = spawnSync('git', ['status', '--porcelain', '--', '.'], {
    cwd: appDir,
    encoding: 'utf8',
  }).stdout.trim();
  return `${r.stdout.trim()}${dirty ? ' (with uncommitted changes)' : ''}`;
}

/** Capture records written by e2e/support/capture.ts. @returns {any[]} */
/** @param {string} dir */
export function readRecords(dir) {
  const recordsDir = path.join(dir, 'records');
  if (!existsSync(recordsDir)) return [];
  return readdirSync(recordsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(recordsDir, f), 'utf8')));
}

export const CAPTURE_PROJECTS = [
  'capture-phone-light',
  'capture-phone-dark',
  'capture-desktop-light',
  'capture-desktop-dark',
];
export const VARIANTS = [
  'phone-light',
  'phone-dark',
  'desktop-light',
  'desktop-dark',
];

/** @param {string} s */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
