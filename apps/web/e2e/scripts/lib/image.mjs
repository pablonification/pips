// Image comparison for the compare and fidelity reports: changed-pixel ratio (pixelmatch), a perceptual score
// (SSIM on luminance), resizing, and side-by-side composites. PNG only.
import { readFileSync, writeFileSync } from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/** @typedef {{ width: number, height: number, data: Uint8Array }} Img */

/** @param {string} file @returns {Img} */
export function readPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: png.data };
}

/** @param {string} file @param {Img} img */
export function writePng(file, img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(
    img.data.buffer,
    img.data.byteOffset,
    img.data.byteLength,
  );
  writeFileSync(file, PNG.sync.write(png));
}

/** The image without its top `rows` pixel rows. @param {Img} img @param {number} rows @returns {Img} */
export function cropTop(img, rows) {
  const r = Math.max(0, Math.min(img.height, Math.round(rows)));
  return {
    width: img.width,
    height: img.height - r,
    data: img.data.slice(r * img.width * 4),
  };
}

/** @param {number} width @param {number} height @param {[number, number, number]} rgb @returns {Img} */
export function blank(width, height, rgb = [255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
  return { width, height, data };
}

/**
 * Area-average resize (good for downscaling, fine for small upscales).
 * @param {Img} img @param {number} width @param {number} height @returns {Img}
 */
export function resize(img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new Uint8Array(width * height * 4);
  const sx = img.width / width;
  const sy = img.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.min(img.height, Math.floor((y + 1) * sy)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(
        x0 + 1,
        Math.min(img.width, Math.floor((x + 1) * sx)),
      );
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += img.data[i + c];
          n++;
        }
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = Math.round(acc[c] / n);
    }
  }
  return { width, height, data: out };
}

/** Pads or crops to the given size from the top left, so images of different heights can be compared. */
/**
 * @param {Img} img @param {number} width @param {number} height
 * @param {[number, number, number]} [rgb]
 */
export function fit(img, width, height, rgb = [255, 255, 255]) {
  if (img.width === width && img.height === height) return img;
  const out = blank(width, height, rgb);
  for (let y = 0; y < Math.min(height, img.height); y++) {
    const row = img.data.subarray(
      y * img.width * 4,
      (y * img.width + Math.min(width, img.width)) * 4,
    );
    out.data.set(row, y * width * 4);
  }
  return out;
}

/**
 * compare-before's threshold: a capture counts as changed when more than this share of its pixels differ
 * (0.01 %: about 130 pixels of a 1440 × 900 desktop capture or a 390 × 844 phone capture at device scale 2). Unchanged builds
 * are pixel-identical; a toast or a changed word is several hundred pixels and must count.
 */
export const COMPARE_THRESHOLD = 0.0001;

/**
 * Changed pixels between two images of the same size, and a diff image (changed pixels in red over a faded copy).
 * `threshold` is pixelmatch's per-pixel colour tolerance (0–1); anti-aliasing differences are ignored.
 * @param {Img} a @param {Img} b
 */
export function pixelDiff(a, b, threshold = 0.1) {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error(
      `size differs: ${a.width}×${a.height} vs ${b.width}×${b.height}`,
    );
  const diff = {
    width: a.width,
    height: a.height,
    data: new Uint8Array(a.data.length),
  };
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold,
    includeAA: false,
    alpha: 0.2,
  });
  return { changed, ratio: changed / (a.width * a.height), diff };
}

/** @param {Img} img */
function luminance(img) {
  const out = new Float64Array(img.width * img.height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++)
    out[p] =
      0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  return out;
}

/**
 * Mean structural similarity (SSIM) of two images on luminance, over 8 × 8 windows, after scaling both to `width`.
 * 1 means identical; around 0.9 and above, layouts agree; low values mean different screens.
 * @param {Img} a @param {Img} b
 */
export function ssim(a, b, width = 360) {
  const height = Math.max(8, Math.round((a.height / a.width) * width));
  const la = luminance(resize(a, width, height));
  const lb = luminance(resize(fit(b, a.width, a.height), width, height));
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let total = 0;
  let windows = 0;
  for (let y = 0; y + 8 <= height; y += 4)
    for (let x = 0; x + 8 <= width; x += 4) {
      let ma = 0,
        mb = 0;
      for (let yy = 0; yy < 8; yy++)
        for (let xx = 0; xx < 8; xx++) {
          const i = (y + yy) * width + x + xx;
          ma += la[i];
          mb += lb[i];
        }
      ma /= 64;
      mb /= 64;
      let va = 0,
        vb = 0,
        cov = 0;
      for (let yy = 0; yy < 8; yy++)
        for (let xx = 0; xx < 8; xx++) {
          const i = (y + yy) * width + x + xx;
          const da = la[i] - ma;
          const db = lb[i] - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      va /= 63;
      vb /= 63;
      cov /= 63;
      total +=
        ((2 * ma * mb + C1) * (2 * cov + C2)) /
        ((ma * ma + mb * mb + C1) * (va + vb + C2));
      windows++;
    }
  return windows ? total / windows : 1;
}

/** Images next to each other on a grey strip, each scaled to the same height. @param {Img[]} imgs */
export function sideBySide(
  imgs,
  height = Math.max(...imgs.map((i) => i.height)),
  gap = 16,
) {
  const scaled = imgs.map((img) =>
    resize(
      img,
      Math.max(1, Math.round((img.width * height) / img.height)),
      height,
    ),
  );
  const width =
    scaled.reduce((n, i) => n + i.width, 0) + gap * (scaled.length + 1);
  const out = blank(width, height + gap * 2, [128, 128, 128]);
  let x = gap;
  for (const img of scaled) {
    for (let y = 0; y < img.height; y++)
      out.data.set(
        img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4),
        ((y + gap) * width + x) * 4,
      );
    x += img.width + gap;
  }
  return out;
}
