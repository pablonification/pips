/**
 * The few checks the app makes on data it didn't receive from the API (F2-004): the URL's search params and the member
 * kept on the device. They were zod schemas, and zod (12.5 KiB gzip) then loaded before every page's first render
 * (SPEC "Performance architecture and budgets"). These do exactly what those schemas did, and
 * `tests/params.test.ts` holds them to zod's own answers on the same inputs:
 * - `object(shape).parse(input)` keeps only the shape's keys (others are dropped), and throws on a non-object. Each
 *   key is zod's `.optional().catch(undefined)`: a key that is there but doesn't pass is kept as `undefined` (never
 *   an error page), a key that isn't there stays out;
 * - `object(shape, { strict: true })` is a plain zod object: every key must pass, or `parse` throws.
 */

/** A value check: the value to keep (perhaps converted), or `INVALID`. */
export type Check<T> = (value: unknown) => T | typeof INVALID;
export const INVALID: unique symbol = Symbol('invalid');

type Shape = Record<string, Check<unknown>>;
type Out<S extends Shape, Strict extends boolean> = Strict extends true
  ? { [K in keyof S]: Exclude<ReturnType<S[K]>, typeof INVALID> }
  : { [K in keyof S]?: Exclude<ReturnType<S[K]>, typeof INVALID> };

export interface ObjectSchema<S extends Shape, Strict extends boolean = false> {
  readonly shape: S;
  parse(input: unknown): Out<S, Strict>;
  /** The same check with more keys (zod's `.extend`). */
  extend<M extends Shape>(more: M): ObjectSchema<S & M, Strict>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function object<S extends Shape, Strict extends boolean = false>(
  shape: S,
  options?: { strict?: Strict },
): ObjectSchema<S, Strict> {
  const strict = options?.strict === true;
  return {
    shape,
    parse(input) {
      if (!isObject(input)) throw new TypeError('Expected an object');
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        const present = key in input;
        const value = shape[key](input[key]);
        if (strict) {
          if (value === INVALID) throw new TypeError(`Invalid ${key}`);
          if (present || value !== undefined) out[key] = value;
        } else if (present) out[key] = value === INVALID ? undefined : value;
      }
      return out as Out<S, Strict>;
    },
    extend(more) {
      return object({ ...shape, ...more }, options);
    },
  };
}

/** A check that also lets `undefined` through (zod's `.optional()`). */
export const optional =
  <T>(check: Check<T>): Check<T | undefined> =>
  (v) =>
    v === undefined ? undefined : check(v);

export const string: Check<string> = (v) =>
  typeof v === 'string' ? v : INVALID;
/** A string of at least one character (zod's `.min(1)`). */
export const nonEmpty: Check<string> = (v) =>
  typeof v === 'string' && v.length >= 1 ? v : INVALID;
export const boolean: Check<boolean> = (v) =>
  typeof v === 'boolean' ? v : INVALID;
/** A number that isn't NaN, as zod's `z.number()`. */
export const number: Check<number> = (v) =>
  typeof v === 'number' && !Number.isNaN(v) ? v : INVALID;
/** zod's `z.coerce.number()`: `Number(value)`, unless that is NaN. */
export const coerceNumber: Check<number> = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? INVALID : n;
};
export const literal =
  <const L extends string | number>(...values: L[]): Check<L> =>
  (v) =>
    (values as unknown[]).includes(v) ? (v as L) : INVALID;
export const arrayOf =
  <T>(check: Check<T>): Check<T[]> =>
  (v) => {
    if (!Array.isArray(v)) return INVALID;
    const out: T[] = [];
    for (const item of v) {
      const x = check(item);
      if (x === INVALID) return INVALID;
      out.push(x);
    }
    return out;
  };
export const nullable =
  <T>(check: Check<T>): Check<T | null> =>
  (v) =>
    v === null ? null : check(v);
