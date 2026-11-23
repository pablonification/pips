/**
 * The six reactions as 10 × 10 pixel art, and their names.
 * Each letter is a colour class in components.css: # rim (ink, bronze in dark mode), o gold, w white, r red,
 * c cream, l blue, b bronze, n orange, d deep orange, y yellow, i ink in both themes (an open mouth stays dark when
 * the rim turns bronze); . is empty. Rayakan is a party popper, not a face, so it never reads as Senyum lebar.
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
    '.....#....',
    '....#d#...',
    '...#dn#.#.',
    '..#dnnd#d#',
    '.#dnnyndd#',
    '#d#nyynnd#',
    '#dnnyyyyn#',
    '#dnyycyyn#',
    '.#nyccyn#.',
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
    '.#l#ll#l#.',
    '#llllllll#',
    '#lwwllwwl#',
    '#ow#oo#wo#',
    '#ooo##ooo#',
    '#oo#ii#oo#',
    '#oo#ii#oo#',
    '.#oo##oo#.',
    '..######..',
  ],
  party: [
    '.l..c...r.',
    '...r..l...',
    'c.....r.c.',
    '..l..##...',
    '....#cc#.l',
    '...#rcc#..',
    '..#orr#.r.',
    '.#oor#....',
    '#oo#......',
    '##........',
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

interface PixelRun {
  x: number;
  y: number;
  width: number;
  colour: string;
}

/** Runs of equal pixels per row: one rect per run. */
export function pixelRuns(key: PixelReactionKey): PixelRun[] {
  const runs: PixelRun[] = [];
  PIXEL_REACTIONS[key].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      if (ch !== '.')
        runs.push({ x, y, width: n, colour: ch === '#' ? 'k' : ch });
      x += n;
    }
  });
  return runs;
}
