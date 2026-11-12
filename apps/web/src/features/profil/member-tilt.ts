/**
 * The member card's tilt: the card leans toward the pointer or finger, at most 8° sideways and 6° up or down, and the
 * sheen follows it across. It settles back when the pointer leaves. Nothing moves under reduced motion.
 */

/** Where a pointer sits on the card, as the card's custom properties. */
interface Tilt {
  /** The turn round the vertical axis (`rotateY`), in degrees: ±8. */
  rx: number;
  /** The turn round the horizontal axis (`rotateX`), in degrees: ±6. */
  ry: number;
  /** The sheen's position across the card, 0–100 %. */
  mx: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The tilt for a pointer at (x, y) over a card at `rect`; a pointer beyond the card counts as on its edge. */
export function tiltAt(
  rect: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
): Tilt {
  const px = rect.width ? clamp01((x - rect.left) / rect.width) : 0.5;
  const py = rect.height ? clamp01((y - rect.top) / rect.height) : 0.5;
  return { rx: (px - 0.5) * 16, ry: (0.5 - py) * 12, mx: px * 100 };
}

const PROPS = ['--rx', '--ry', '--mx'] as const;

/** Leans the card toward the pointer and lights it ("lit" quickens the transition and shows the sheen). */
export function leanCard(card: HTMLElement, x: number, y: number) {
  const t = tiltAt(card.getBoundingClientRect(), x, y);
  card.style.setProperty('--rx', `${t.rx.toFixed(2)}deg`);
  card.style.setProperty('--ry', `${t.ry.toFixed(2)}deg`);
  card.style.setProperty('--mx', `${t.mx.toFixed(1)}%`);
  card.classList.add('lit');
}

/** Lets the card settle back flat, its sheen fading out. */
export function settleCard(card: HTMLElement) {
  card.classList.remove('lit');
  for (const p of PROPS) card.style.removeProperty(p);
}

/** Reduced motion asked for: no tilt, sweep or sheen. */
export const motionReduced = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
