// The stills' file names, as each capture spec writes them (e2e/review/stills.ts `STILL_SOURCES`, whose `parse`
// functions these mirror for plain Node; tests/review-stills.test.ts checks both read every name alike).
const LAYOUT = (/** @type {string} */ l) => (l === 'desk' ? 'desktop' : l);

/** @type {Record<string, RegExp>} */
export const STILL_NAMES = {
  'P1-C': /^(phone|tablet|desk)-(.+)-(light|dark)\.png$/,
  'P2-C': /^(phone|tablet|desk)-p2c-(.+)-(light|dark)\.png$/,
  'P3-C': /^(phone|tablet|desk)-(.+)-(light|dark)\.png$/,
  'P3-B': /^(phone|tablet|desk)-(.+)-(light|dark)\.png$/,
  'P2-A': /^(phone|tablet|desktop)-(light|dark)-(\d+)-(.+)\.png$/,
  F1: /^(phone|tablet|desktop)-(.+)-(light|dark)\.png$/,
};

/** A capture's layout, state and theme, or null. @param {string} source @param {string} file */
export function parseStill(source, file) {
  const re = STILL_NAMES[source];
  const m = re ? re.exec(file) : null;
  if (!m) return null;
  if (source === 'P2-A') return { layout: m[1], state: `${m[4]}-${m[3]}`, theme: m[2] };
  return { layout: LAYOUT(m[1]), state: m[2], theme: m[3] };
}
