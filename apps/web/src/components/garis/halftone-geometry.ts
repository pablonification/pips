export interface HalftoneSquare {
  x: number;
  y: number;
  size: number;
}

/**
 * Beranda's header pattern (garis/ui.js `halftone()`): squares on a `cell` px grid that grow from nothing to
 * `cell - 1` px toward the right over `length` px. One row; the pattern repeats downward.
 */
export function halftoneSquares(length: number, cell = 8): HalftoneSquare[] {
  const n = Math.round(length / cell);
  const out: HalftoneSquare[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.round(Math.pow((i + 1) / n, 1.6) * (cell - 1));
    if (z > 0)
      out.push({ x: i * cell + (cell - z) / 2, y: (cell - z) / 2, size: z });
  }
  return out;
}
