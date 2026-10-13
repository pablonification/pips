/**
 * Waiting for a form to open (SPEC "Server windows"). The countdown runs on the device's clock, but the server decides:
 * at zero the screen asks again, then every 3 s (plus up to 1 s of jitter, so a whole angkatan doesn't ask at once) for
 * at most 2 minutes. Questions show only when the server sends `sections`.
 */
export const POLL_EVERY_MS = 3000;
export const POLL_JITTER_MS = 1000;
export const POLL_FOR_MS = 120_000;

export type OpeningStep =
  /** Still counting down: check again at `at` (the opening time). */
  | { kind: 'wait'; at: number }
  /** Ask the server now, then again after `delay`. */
  | { kind: 'poll'; delay: number }
  /** The server sent the questions. */
  | { kind: 'open' }
  /** Two minutes went by without them: show the error with Coba lagi. */
  | { kind: 'give-up' };

/**
 * The next step, from the opening time, when polling started (null before zero), the time now, whether the server has
 * sent `sections`, and a random number in [0, 1) for the jitter.
 */
export function openingStep({
  opensAt,
  pollingSince,
  now,
  hasSections,
  random,
}: {
  opensAt: number;
  pollingSince: number | null;
  now: number;
  hasSections: boolean;
  random: number;
}): OpeningStep {
  if (hasSections) return { kind: 'open' };
  if (now < opensAt && pollingSince === null)
    return { kind: 'wait', at: opensAt };
  const since = pollingSince ?? now;
  if (now - since >= POLL_FOR_MS) return { kind: 'give-up' };
  return {
    kind: 'poll',
    delay: POLL_EVERY_MS + Math.floor(random * POLL_JITTER_MS),
  };
}
