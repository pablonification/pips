// F1's media conversion: Playwright's WebM recordings to H.264 MP4, posters and stills to WebP. Every tool is called
// with an argument array, never a shell string, and only from the paths below (Homebrew's ffmpeg and cwebp on the
// owner's Mac; FFMPEG and CWEBP override them). Nothing is ever installed.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const TOOLS = {
  ffmpeg: process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg',
  cwebp: process.env.CWEBP ?? '/opt/homebrew/bin/cwebp',
};

/** The default quality: CRF 32 keeps 12 px text, 1 px rings and the gold keycap edges readable (F1 brief, measured). */
export const DEFAULT_CRF = 32;
/** The steps the budget may take, then stop (F1 brief, "How to apply it", 3). */
export const CRF_STEPS = [32, 34];
export const POSTER_WIDTH = 360;

/** The tools missing on this machine, by name. */
export function missingTools(tools = TOOLS, exists = existsSync) {
  return Object.entries(tools)
    .filter(([, file]) => !exists(file))
    .map(([name, file]) => `${name} (${file})`);
}

/**
 * WebM → MP4: H.264 at `crf`, preset slow, 25 fps, yuv420p (plays everywhere), +faststart (plays while loading), no
 * audio. The size is rounded down to even numbers, which H.264 needs.
 * @param {string} input @param {string} output @param {{ crf?: number }} [o]
 */
export function mp4Args(input, output, { crf = DEFAULT_CRF } = {}) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(crf),
    '-r',
    '25',
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ];
}

/** One PNG frame at `atSeconds` (the poster, before cwebp). @param {string} input @param {string} output */
export function frameArgs(input, output, atSeconds = 2) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(atSeconds),
    '-i',
    input,
    '-frames:v',
    '1',
    output,
  ];
}

/**
 * PNG → WebP at quality `q`, resized to `width` CSS px when given (height kept in proportion).
 * @param {string} input @param {string} output @param {{ q?: number, width?: number }} [o]
 */
export function webpArgs(input, output, { q = 80, width } = {}) {
  return [
    '-quiet',
    '-q',
    String(q),
    ...(width ? ['-resize', String(width), '0'] : []),
    input,
    '-o',
    output,
  ];
}

/** Runs a tool with an argument array; throws with its output when it fails. @param {string} tool @param {string[]} args */
export function run(tool, args, spawn = spawnSync) {
  const r = spawn(tool, args, { encoding: 'utf8' });
  if (r.status !== 0)
    throw new Error(
      `${tool} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout || '').slice(0, 400)}`,
    );
  return r;
}

/** The duration of a video in seconds (ffmpeg prints it to stderr). @param {string} file */
export function durationOf(file, spawn = spawnSync) {
  const r = spawn(TOOLS.ffmpeg, ['-hide_banner', '-i', file], {
    encoding: 'utf8',
  });
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr ?? '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * The recording's video among the WebM files in a test's output folder: the main page's (`preferred`, from the flow's
 * record) when it is there, else the largest. A flow that opens a link in a new tab gets one video per tab, and the
 * new tab's is a second or so long (F1 part 2: Ding Dong, Info Lomba and Layanan came out 1 s long).
 * @param {{ name: string, size: number }[]} files @param {string | null | undefined} preferred
 */
export function pickVideo(files, preferred) {
  const webms = files.filter((f) => f.name.endsWith('.webm'));
  if (preferred && webms.some((f) => f.name === preferred)) return preferred;
  return webms.sort((a, b) => b.size - a.size)[0]?.name ?? null;
}
