import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pixelFormSections } from '../src/db/seed/pixel-form-seed';
import { FormQuestionSchema } from '../src/types/form.types';

test('a question may ask the app to prefill the member’s name or NIM, and nothing else', () => {
  const q = { id: 'q1', label: 'Nama', type: 'text' as const };
  assert.equal(
    FormQuestionSchema.parse({ ...q, prefill: 'fullName' }).prefill,
    'fullName',
  );
  assert.equal(
    FormQuestionSchema.parse({ ...q, prefill: 'nim' }).prefill,
    'nim',
  );
  assert.equal(FormQuestionSchema.parse(q).prefill, undefined);
  assert.equal(
    FormQuestionSchema.safeParse({ ...q, prefill: 'email' }).success,
    false,
  );
});

test('the PIXEL form prefills q1 with the name and q2 with the NIM, and no other question', () => {
  const prefilled = pixelFormSections
    .flatMap((s) => s.questions)
    .filter((q) => q.prefill)
    .map((q) => [q.id, q.prefill]);
  assert.deepEqual(prefilled, [
    ['q1', 'fullName'],
    ['q2', 'nim'],
  ]);
  for (const section of pixelFormSections)
    for (const question of section.questions)
      assert.deepEqual(
        FormQuestionSchema.parse(question),
        question,
        question.id,
      );
});
