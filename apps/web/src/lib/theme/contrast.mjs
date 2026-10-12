// WCAG 2 contrast, shared by the gallery (live measurements) and tests/garis-tokens.test.mjs (every token pair).

/** @param {string} hex #rgb or #rrggbb */
export function hexToRgb(hex) {
  let v = hex.trim().replace('#', '');
  if (v.length === 3) v = [...v].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(v)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

/** Relative luminance of an sRGB colour given as [r, g, b] (0–255). */
export function luminance([r, g, b]) {
  return [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}

/** Contrast ratio between two hex colours (1–21). */
export function contrast(a, b) {
  const x = luminance(hexToRgb(a));
  const y = luminance(hexToRgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** "17,5:1" (Indonesian decimal comma), two decimals under 2:1 as the prototype shows them. */
export function formatRatio(r) {
  return `${r.toFixed(r < 2 ? 2 : 1).replace('.', ',')}:1`;
}
