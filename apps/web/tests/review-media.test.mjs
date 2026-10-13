// The review's conversions (e2e/scripts/lib/review/media.mjs): exact argument arrays for ffmpeg and cwebp (never a
// shell string), the tools found or reported missing, and a tool's failure surfacing.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CRF,
  frameArgs,
  missingTools,
  mp4Args,
  run,
  webpArgs,
} from '../e2e/scripts/lib/review/media.mjs';

test('WebM → MP4: H.264, CRF 32, preset slow, 25 fps, even size, yuv420p, faststart, no audio', () => {
  assert.equal(DEFAULT_CRF, 32);
  assert.deepEqual(mp4Args('in.webm', 'out.mp4'), [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    'in.webm',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '32',
    '-r',
    '25',
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    'out.mp4',
  ]);
  assert.equal(mp4Args('a', 'b', { crf: 34 })[12], '34');
});

test('a poster frame, then WebP at q 80, resized when asked', () => {
  assert.deepEqual(frameArgs('v.mp4', 'p.png', 2.5), [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    '2.5',
    '-i',
    'v.mp4',
    '-frames:v',
    '1',
    'p.png',
  ]);
  assert.deepEqual(webpArgs('p.png', 'p.webp'), [
    '-quiet',
    '-q',
    '80',
    'p.png',
    '-o',
    'p.webp',
  ]);
  assert.deepEqual(webpArgs('p.png', 'p.webp', { width: 360 }), [
    '-quiet',
    '-q',
    '80',
    '-resize',
    '360',
    '0',
    'p.png',
    '-o',
    'p.webp',
  ]);
});

test('missing tools are named with their paths', () => {
  assert.deepEqual(
    missingTools(
      { ffmpeg: '/x/ffmpeg', cwebp: '/y/cwebp' },
      (f) => f === '/x/ffmpeg',
    ),
    ['cwebp (/y/cwebp)'],
  );
});

test('a tool is run with its argument array; a failure throws with its output', () => {
  /** @type {any[]} */
  const calls = [];
  const ok = (/** @type {string} */ tool, /** @type {string[]} */ a) => (
    calls.push([tool, a]),
    { status: 0, stdout: '', stderr: '' }
  );
  run('/bin/tool', ['-a', 'b c'], /** @type {any} */ (ok));
  assert.deepEqual(calls, [['/bin/tool', ['-a', 'b c']]]);
  const bad = () => ({ status: 1, stdout: '', stderr: 'boom' });
  assert.throws(() => run('/bin/tool', [], /** @type {any} */ (bad)), /boom/);
});
