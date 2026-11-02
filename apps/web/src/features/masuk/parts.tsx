/*
 * The Masuk screen's pieces (garis/screens-masuk.js, Garis v5): the keyboard header's keys and the slide data. The
 * screen and its behaviour are in LoginScreen.tsx.
 */
import type { ComponentType } from 'react';
import type { IconProps } from '~/components/icons/icon';
import { GarisGlyph } from '~/components/icons/icon';
import { GlyphCurhat } from '~/components/icons/curhat';
import { GlyphFolder } from '~/components/icons/folder';
import { GlyphForm } from '~/components/icons/form';
import { GlyphLomba } from '~/components/icons/lomba';
import { GlyphNim } from '~/components/icons/nim';
import { GlyphTesti } from '~/components/icons/testi';
import type { PixelReactionKey } from '~/components/garis/pixel-art';

type Glyph = ComponentType<Omit<IconProps, 'size'>>;

/** Pengumuman in Beranda's two-tone style: the prototype's own fill under the icon's lines (`MK_FILL`). */
function GlyphPengumuman(props: Omit<IconProps, 'size'>) {
  return (
    <GarisGlyph {...props}>
      <path className="gf" d="M3.5 9h4L14 5v14l-6.5-4h-4z" />
      <path d="M3.5 9h4L14 5v14l-6.5-4h-4z" />
      <path d="M7.5 15v5H10" />
      <path d="M17.5 9h3.5M17.5 12h3.5M17.5 15h3.5" />
    </GarisGlyph>
  );
}

/** Kalender in the same style: the header band filled. */
function GlyphKalender(props: Omit<IconProps, 'size'>) {
  return (
    <GarisGlyph {...props}>
      <path className="gf" d="M3.5 5.5h17V10h-17z" />
      <path d="M3.5 5.5h17v15h-17z" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
      <path d="M7 13.5h3.5M13.5 13.5H17M7 17h3.5" />
    </GarisGlyph>
  );
}

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

export const KEY_GLYPHS: Record<Exclude<KeyName, 'pips'>, Glyph> = {
  pengumuman: GlyphPengumuman,
  kalender: GlyphKalender,
  folder: GlyphFolder,
  testi: GlyphTesti,
  nim: GlyphNim,
  lomba: GlyphLomba,
  curhat: GlyphCurhat,
  form: GlyphForm,
};

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
