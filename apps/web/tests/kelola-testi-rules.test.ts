// P3-B: Tambah testimoni's rules (brief rule 7): sections by programme, empty ones null, at least one written.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  newTestiDraft,
  testiBody,
  testiSections,
  validateTesti,
} from '../src/features/kelola-testi/rules';

test('IF and OTHER courses ask Overview, Tugas and Review Dosen; STI courses Kesan, Tantangan and Saran', () => {
  const titles = (m: 'IF' | 'STI' | 'OTHER') =>
    testiSections(m).map((s) => `${s.key}:${s.title}`);
  assert.deepEqual(titles('IF'), [
    'overview:Overview',
    'assignments:Tugas',
    'lecturer_review:Review Dosen',
  ]);
  assert.deepEqual(titles('OTHER'), titles('IF'));
  assert.deepEqual(titles('STI'), [
    'impressions:Kesan',
    'challenges:Tantangan',
    'advice:Saran',
  ]);
});

test('at least one of the programme’s sections must be written; spaces alone don’t count', () => {
  const empty = newTestiDraft();
  assert.equal(validateTesti('IF', empty), 'Tulis minimal satu bagian.');
  assert.equal(
    validateTesti('IF', { ...empty, sections: { overview: '   ' } }),
    'Tulis minimal satu bagian.',
  );
  // Another programme's section doesn't count: the dialog never shows it.
  assert.equal(
    validateTesti('IF', { ...empty, sections: { impressions: 'Seru' } }),
    'Tulis minimal satu bagian.',
  );
  assert.equal(
    validateTesti('STI', { ...empty, sections: { advice: 'Rajin latihan' } }),
    null,
  );
});

test('the body: empty sections, author and lecturer are null; only the programme’s sections are sent', () => {
  assert.deepEqual(
    testiBody('course-IF2110', 'IF', {
      userName: '  ',
      sections: { overview: ' Struktur data dasar. ', assignments: '' },
      lecturer: '',
    }),
    {
      courseId: 'course-IF2110',
      userName: null,
      overview: 'Struktur data dasar.',
      assignments: null,
      lecturer_review: null,
      lecturer: null,
    },
  );
  assert.deepEqual(
    testiBody('course-II2110', 'STI', {
      userName: 'Fikri, II 2023',
      sections: { challenges: 'Tugas besar', overview: 'ignored' },
      lecturer: 'Dr. Rina',
    }),
    {
      courseId: 'course-II2110',
      userName: 'Fikri, II 2023',
      impressions: null,
      challenges: 'Tugas besar',
      advice: null,
      lecturer: 'Dr. Rina',
    },
  );
});
