/*
 * The Masuk screen's pieces (garis/screens-masuk.js, Garis v5): the keyboard header's keys, its halftone and the
 * slide data. The screen and its behaviour are in LoginScreen.tsx.
 *
 * The keys' glyphs and the halftone are drawn here rather than imported from components/icons and Halftone: those
 * modules live in the build's shared `ui` chunk (vite.config.ts), and loading it would put the push prompt, the
 * dialogs and their libraries before sign-in's first render (/login went from 144 to 190 KiB gzip). The paths are
 * the Garis set's own, and tests/masuk-parts.test.ts keeps them equal to the generated icons and to halftone-geometry.
 */
import { useId } from 'react';
import type { PixelReactionKey } from '~/components/garis/pixel-art';
import { GarisGlyph } from '~/components/icons/icon';

export type KeyName =
  | 'pengumuman'
  | 'kalender'
  | 'folder'
  | 'testi'
  | 'pips'
  | 'nim'
  | 'lomba'
  | 'curhat'
  | 'form';

type Path = readonly [cls: 'gf' | 'f' | null, d: string];

/**
 * Each key's two-tone glyph: Beranda's service glyphs (components/icons Glyph*, gold fill first, then the lines),
 * plus Pengumuman and Kalender with the prototype's own fills (`MK_FILL`) under their icons' lines.
 */
export const KEY_PATHS: Record<Exclude<KeyName, 'pips'>, readonly Path[]> = {
  pengumuman: [
    ['gf', 'M3.5 9h4L14 5v14l-6.5-4h-4z'],
    [null, 'M3.5 9h4L14 5v14l-6.5-4h-4z'],
    [null, 'M7.5 15v5H10'],
    [null, 'M17.5 9h3.5M17.5 12h3.5M17.5 15h3.5'],
  ],
  kalender: [
    ['gf', 'M3.5 5.5h17V10h-17z'],
    [null, 'M3.5 5.5h17v15h-17z'],
    [null, 'M3.5 10h17'],
    [null, 'M8 3v4M16 3v4'],
    [null, 'M7 13.5h3.5M13.5 13.5H17M7 17h3.5'],
  ],
  folder: [
    ['gf', 'M3.5 11h17v8h-17z'],
    [null, 'M3.5 6h6l2 2.5h9V19h-17z'],
    [null, 'M3.5 11h17'],
  ],
  testi: [
    [
      'gf',
      'M12 3.5l2.55 5.7 6.2.55-4.7 4.1 1.4 6.1L12 16.7l-5.45 3.25 1.4-6.1-4.7-4.1 6.2-.55z',
    ],
    [
      null,
      'M12 3.5l2.55 5.7 6.2.55-4.7 4.1 1.4 6.1L12 16.7l-5.45 3.25 1.4-6.1-4.7-4.1 6.2-.55z',
    ],
  ],
  nim: [
    ['gf', 'M6.5 9H11v5.5H6.5z'],
    [null, 'M3 5.5h18v13H3z'],
    [null, 'M6.5 9H11v5.5H6.5z'],
    [null, 'M14 9.5h4M14 12.5h4M14 15.5h2.5'],
  ],
  lomba: [
    ['gf', 'M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z'],
    [null, 'M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z'],
    [
      null,
      'M7.5 6H4v2.5A3.5 3.5 0 0 0 7.5 12M16.5 6H20v2.5a3.5 3.5 0 0 1-3.5 3.5',
    ],
    [null, 'M12 14v4.5M8 20.5h8'],
  ],
  curhat: [
    ['gf', 'M4 4.5h16V16h-8.5l-5 4v-4H4z'],
    [null, 'M4 4.5h16V16h-8.5l-5 4v-4H4z'],
    ['f', 'M7.75 9.25h2v2h-2zM11 9.25h2v2h-2zM14.25 9.25h2v2h-2z'],
  ],
  form: [
    ['gf', 'M9 3h6v3H9z'],
    [null, 'M5 4.5h14V21H5z'],
    [null, 'M9 3h6v3H9z'],
    [null, 'M8.5 10.5h7M8.5 13.5h7M8.5 16.5h4'],
  ],
};

/** A key's glyph, in the Garis glyph frame (24 px, 1.5 px line). */
export function KeyGlyph({ name }: { name: Exclude<KeyName, 'pips'> }) {
  return (
    <GarisGlyph>
      {KEY_PATHS[name].map(([cls, d]) => (
        <path key={`${cls}${d}`} className={cls ?? undefined} d={d} />
      ))}
    </GarisGlyph>
  );
}

/** Beranda's halftone squares (halftone-geometry.ts, garis/ui.js `halftone()`): one row, repeated downward. */
export function halftoneRow(length: number, cell = 8) {
  const n = Math.round(length / cell);
  const out: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.round(Math.pow((i + 1) / n, 1.6) * (cell - 1));
    if (z > 0)
      out.push({ x: i * cell + (cell - z) / 2, y: (cell - z) / 2, size: z });
  }
  return out;
}

/** The header's halftone (as components/garis/Halftone.tsx draws it), in `--hero-tone`, filling its box. */
export function MasukHalftone({ length }: { length: number }) {
  const id = `mk-ht${useId().replace(/:/g, '')}`;
  const cell = 8;
  return (
    <span className="g-halftone" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        fill="currentColor"
        shapeRendering="crispEdges"
        focusable="false"
      >
        <defs>
          <pattern
            id={id}
            width={Math.round(length / cell) * cell}
            height={cell}
            patternUnits="userSpaceOnUse"
          >
            {halftoneRow(length, cell).map((s) => (
              <rect key={s.x} x={s.x} y={s.y} width={s.size} height={s.size} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </span>
  );
}

/** Three staggered rows of keys; the middle one is the gold PIPS! key (`MK_ROWS`). */
export const KEY_ROWS: KeyName[][] = [
  ['pengumuman', 'kalender', 'folder'],
  ['testi', 'pips', 'nim'],
  ['lomba', 'curhat', 'form'],
];

/** The four pixel reactions around the board (`MK_PX`). */
export const BOARD_REACTIONS: [PixelReactionKey, string][] = [
  ['grin', 'p1'],
  ['heart-eyes', 'p2'],
  ['fire', 'p3'],
  ['party', 'p4'],
];

/** What each slide lights in the header, and the reaction that rises from its first key (`MASUK_SLIDES`). */
export const SLIDE_HERO: { keys: KeyName[]; px: PixelReactionKey }[] = [
  { keys: ['pengumuman'], px: 'fire' },
  { keys: ['kalender'], px: 'screaming' },
  { keys: ['folder', 'testi', 'nim'], px: 'party' },
  { keys: ['curhat'], px: 'heart-eyes' },
];

/**
 * Google's "G", whole, in one colour: the button's ink (owner, 2026-11-02; Google's branding allows a monochrome G).
 * Hidden from screen readers: the button already says "Masuk dengan Google".
 */
export function GoogleG() {
  return (
    <span className="g-mk-g" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="currentColor" focusable="false">
        <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}
