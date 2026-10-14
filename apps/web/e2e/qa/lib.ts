/**
 * F2's pure helpers for the cross-cutting checks in e2e/qa (unit-tested in tests/qa-lib.test.ts): colours and their
 * contrast, the text normaliser of the prototype copy check, and the motion sampler's threshold. Nothing here
 * touches a page, so the same code runs in Node and, through `page.evaluate`, needs no copy.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * A computed CSS colour as Chromium reports it: `rgb(…)`, `rgba(…)`, either with commas or spaces and a `/ alpha`,
 * or `color(srgb r g b / a)` (what `color-mix` in sRGB computes to). Anything else (oklab, keywords) is null:
 * the caller leaves that colour out rather than guessing.
 */
export function parseColor(css: string): Rgba | null {
  const s = css.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
      s,
    );
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: alpha(m[4]),
    };
  }
  m =
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
      s,
    );
  if (m) {
    return {
      r: Number(m[1]) * 255,
      g: Number(m[2]) * 255,
      b: Number(m[3]) * 255,
      a: alpha(m[4]),
    };
  }
  return null;
}

function alpha(v: string | undefined): number {
  if (v === undefined) return 1;
  return v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v);
}

/** `top` painted over `bottom` (bottom opaque). */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

/** WCAG 2 relative luminance of an opaque colour. */
export function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Visible text, normalised for the copy check (brief step 11): typographic quotes and dashes as plain ones, every
 * run of white space (non-breaking and thin spaces too) as one space, the ellipsis as three dots, trimmed.
 */
export function normaliseText(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\s\u00A0\u2009\u202F]+/g, ' ')
    .trim();
}

/** The normalised lines of a text, empty ones dropped (the copy check diffs lines, not one long string). */
export function textLines(s: string): string[] {
  return s
    .split(/\n+/)
    .map(normaliseText)
    .filter((l) => l.length > 0);
}

/** Lines in `a` that `b` doesn't have (each counted once per occurrence). */
export function missingLines(a: string[], b: string[]): string[] {
  const left = new Map<string, number>();
  for (const l of b) left.set(l, (left.get(l) ?? 0) + 1);
  const out: string[] = [];
  for (const l of a) {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    else out.push(l);
  }
  return out;
}

/** One frame of an element's motion: its transform matrix, opacity and box, as the sampler reads them. */
export interface MotionSample {
  transform: string;
  opacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Whether an element moved over its samples (brief step 6, A11): a change in its transform, an opacity change of
 * more than 0.01, or its box moving or resizing by more than half a pixel. Layout that settles (a list filling in)
 * isn't motion, so the caller samples one element at a time, after it has been laid out.
 */
export function moved(samples: MotionSample[]): string | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  for (const s of samples.slice(1)) {
    if (s.transform !== first.transform)
      return `transform ${first.transform} → ${s.transform}`;
    if (Math.abs(s.opacity - first.opacity) > 0.01)
      return `opacity ${first.opacity} → ${s.opacity}`;
    if (
      Math.abs(s.x - first.x) > 0.5 ||
      Math.abs(s.y - first.y) > 0.5 ||
      Math.abs(s.w - first.w) > 0.5 ||
      Math.abs(s.h - first.h) > 0.5
    )
      return `box (${first.x},${first.y} ${first.w}×${first.h}) → (${s.x},${s.y} ${s.w}×${s.h})`;
  }
  return null;
}

/** A computed `font-family`'s first face, unquoted. */
export function firstFace(fontFamily: string): string {
  return (fontFamily.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/** Whether a face is monospace (the generic family, or a known monospace face). */
export function isMonospace(fontFamily: string): boolean {
  return fontFamily
    .split(',')
    .map((f) =>
      f
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase(),
    )
    .some((f) =>
      /^(monospace|ui-monospace|menlo|monaco|consolas|courier|courier new|sf mono|geist mono|jetbrains mono|fira code)$/.test(
        f,
      ),
    );
}

/** An image's `alt` that names nothing: a file name, or a generic word (A14). */
export function badAlt(alt: string): boolean {
  const a = alt.trim().toLowerCase();
  if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(a)) return true;
  return /^(image|img|gambar|foto|photo|picture|icon|ikon|avatar)$/.test(a);
}
