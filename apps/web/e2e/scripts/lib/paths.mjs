// Where the harness writes its records. The before set, compare reports and fidelity reports are records, not
// sources, so they live in the workspace's ops/redesign/ folder outside Git. In a checkout without that folder
// (CI), they go to e2e/.out/ instead. PIPS_OPS_DIR overrides the lookup.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

/** The workspace's `ops/redesign` folder, or null when there is none. */
export function redesignDir() {
  if (process.env.PIPS_OPS_DIR)
    return path.join(path.resolve(process.env.PIPS_OPS_DIR), 'redesign');
  for (let dir = appDir; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'ops', 'redesign');
    if (existsSync(path.join(candidate, 'PLAN.md'))) return candidate;
  }
  return null;
}

/** A record folder: `ops/redesign/<name>` in the workspace, else `e2e/.out/<name>`. */
export function recordDir(name) {
  const base = redesignDir();
  return base ? path.join(base, name) : path.join(appDir, 'e2e', '.out', name);
}

/** The locked prototype screens, or null when this checkout has no workspace around it. */
export function lockedScreensDir() {
  const base = redesignDir();
  const dir =
    base &&
    path.join(
      base,
      '..',
      'ui-revamp-review',
      'runtime',
      'extra',
      'garis-v4',
      'locked-2026-10-12',
      'screens',
    );
  return dir && existsSync(dir) ? dir : null;
}

/** 2026-10-12T14-03-09 style timestamp for report folders. */
export const stamp = (d = new Date()) =>
  d.toISOString().slice(0, 19).replace(/:/g, '-');
