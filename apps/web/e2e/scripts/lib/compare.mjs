// How compare-before rates one state's capture against the before set (pure, so tests/compare-before.test.mjs
// can check it).

/**
 * `removed` when the state no longer exists in the app (its `removed` reason, C1), whatever the pixels say;
 * otherwise `missing` without a capture, `changed` over the threshold or at another size, else `unchanged`.
 * @param {{ captured: boolean, removed?: string, sizeDiffers?: boolean, ratio?: number, threshold: number }} c
 * @returns {'removed' | 'missing' | 'changed' | 'unchanged'}
 */
export function captureStatus({
  captured,
  removed,
  sizeDiffers = false,
  ratio = 0,
  threshold,
}) {
  if (removed) return 'removed';
  if (!captured) return 'missing';
  if (sizeDiffers || ratio > threshold) return 'changed';
  return 'unchanged';
}

/**
 * The report's counts by status. Removed states are neither unchanged nor changed (C1's first version counted
 * them as unchanged).
 * @param {{ status: string }[]} rows
 */
export function summarize(rows) {
  const count = (/** @type {string} */ s) =>
    rows.filter((r) => r.status === s).length;
  return {
    compared: rows.length,
    unchanged: count('unchanged'),
    changed: count('changed'),
    missing: count('missing'),
    removed: count('removed'),
  };
}
