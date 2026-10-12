/**
 * The six reactions as 10 × 10 pixel art (garis/ui.js `PX`), and their names (garis/data.js `REACTIONS`).
 * Each letter is a colour class in components.css: # rim (ink, bronze in dark mode), o gold, w white, r red,
 * c cream, l blue, b bronze; . is empty.
 */
export const PIXEL_REACTIONS = {
  grin: [
    '..######..',
    '.#oooooo#.',
    '#oooooooo#',
    '#oo#oo#oo#',
    '#oo#oo#oo#',
    '#oooooooo#',
    '#o######o#',
    '#o#wwww#o#',
    '.#o####o#.',
    '..######..',
  ],
  'heart-eyes': [
    '..######..',
    '.#oooooo#.',
    '#rorooror#',
    '#rrroorrr#',
    '#orooooro#',
    '#oooooooo#',
    '#o#oooo#o#',
    '#oo####oo#',
    '.#oooooo#.',
    '..######..',
  ],
  fire: [
    '....##....',
    '...#oo#...',
    '..#oooo#..',
    '..#oooo#..',
    '.#oorroo#.',
    '.#orrrro#.',
    '#oorccroo#',
    '#oorccroo#',
    '.#oorroo#.',
    '..######..',
  ],
  cry: [
    '..######..',
    '.#oooooo#.',
    '#oooooooo#',
    '#o##oo##o#',
    '#oloooolo#',
    '#oloooolo#',
    '#ol####lo#',
    '#o#oooo#o#',
    '.#oooooo#.',
    '..######..',
  ],
  screaming: [
    '..######..',
    '.#oooooo#.',
    '#oooooooo#',
    '#owwoowwo#',
    '#ow#oo#wo#',
    '#oooooooo#',
    '#ooo##ooo#',
    '#oo####oo#',
    '.#o####o#.',
    '..######..',
  ],
  party: [
    'c.######.r',
    '.#oooooo#.',
    '#oooooooo#',
    '#o#oooo#o#',
    '##o#oo#o##',
    '#oooooooo#',
    '#o######o#',
    '#o#rrrr#o#',
    '.#o####o#.',
    'l.######.c',
  ],
} as const;

export type PixelReactionKey = keyof typeof PIXEL_REACTIONS;

export const PIXEL_REACTION_KEYS = Object.keys(
  PIXEL_REACTIONS,
) as PixelReactionKey[];

/** The reactions' names, in the order the app offers them. */
export const PIXEL_REACTION_LABELS: Record<PixelReactionKey, string> = {
  grin: 'Senyum lebar',
  'heart-eyes': 'Suka banget',
  fire: 'Keren',
  cry: 'Sedih',
  screaming: 'Kaget',
  party: 'Rayakan',
};

const COLOUR_CLASS: Record<string, string> = {
  '#': 'k',
  o: 'o',
  w: 'w',
  r: 'r',
  c: 'c',
  l: 'l',
  b: 'b',
};

export interface PixelRun {
  x: number;
  y: number;
  width: number;
  colour: string;
}

/** Runs of equal pixels per row, as the prototype draws them (one rect per run). */
export function pixelRuns(key: PixelReactionKey): PixelRun[] {
  const runs: PixelRun[] = [];
  PIXEL_REACTIONS[key].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      if (ch !== '.') runs.push({ x, y, width: n, colour: COLOUR_CLASS[ch] });
      x += n;
    }
  });
  return runs;
}
