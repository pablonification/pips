/**
 * The answers' form state for react-hook-form, and its zod schema built from the form's definition. Field names are
 * `a.q0`, `a.q1` … by the question's place (a question id is any string the builder chose, and a dot or a bracket in
 * a field name means nesting to react-hook-form); `keys` maps them to and from the ids `rules.ts` works with.
 */
import type { FieldErrors, Resolver } from 'react-hook-form';
import { z } from 'zod';
import type { FormSection } from '~/api/generated';
import { isi } from '~/copy/isi';
import {
  missingRequired,
  questionsOf,
  type AnswerValue,
  type FillValues,
} from './rules';

export interface FieldValues {
  a: Record<string, AnswerValue>;
  o: Record<string, string>;
}

/** The field key of each question id, and back. */
export function fieldKeys(sections: readonly FormSection[]) {
  const toKey = new Map<string, string>();
  const toId = new Map<string, string>();
  questionsOf(sections).forEach((q, i) => {
    toKey.set(q.id, `q${i}`);
    toId.set(`q${i}`, q.id);
  });
  return {
    key: (id: string) => toKey.get(id) as string,
    id: (key: string) => toId.get(key) as string,
  };
}
export type FieldKeys = ReturnType<typeof fieldKeys>;

const rename = <V>(
  rec: Record<string, V>,
  map: (k: string) => string | undefined,
): Record<string, V> => {
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(rec)) {
    const to = map(k);
    if (to !== undefined) out[to] = v;
  }
  return out;
};

export const toFill = (v: FieldValues, keys: FieldKeys): FillValues => ({
  a: rename(v.a ?? {}, keys.id),
  o: rename(v.o ?? {}, keys.id),
});
export const toFields = (v: FillValues, keys: FieldKeys): FieldValues => ({
  a: rename(v.a, keys.key),
  o: rename(v.o, keys.key),
});

const answer = z.union([z.string(), z.array(z.string())]);

/**
 * Every required question that shows must be answered: a question hidden by its condition is skipped, as the
 * server skips it (`superRefine` on the answers that decide it).
 */
export function answersSchema(sections: readonly FormSection[]) {
  const keys = fieldKeys(sections);
  return z
    .object({ a: z.record(answer), o: z.record(z.string()) })
    .superRefine((v, ctx) => {
      for (const id of missingRequired(sections, toFill(v, keys)))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['a', keys.key(id)],
          message: isi.tanya.wajib,
        });
    });
}

/** The schema as react-hook-form's resolver: an issue becomes that field's error. */
export function answersResolver(
  sections: readonly FormSection[],
): Resolver<FieldValues> {
  const schema = answersSchema(sections);
  return (values) => {
    const r = schema.safeParse(values);
    if (r.success) return { values, errors: {} };
    const a: Record<string, { type: string; message: string }> = {};
    for (const issue of r.error.issues)
      a[String(issue.path[1])] = { type: 'required', message: issue.message };
    return { values: {}, errors: { a } as unknown as FieldErrors<FieldValues> };
  };
}
