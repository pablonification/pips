// Which files the app offers and checks before uploading (lib/upload-policy.ts), against the API's own list.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as apiPolicy from '../../api/src/lib/upload-policy';
import { ApiError } from '../src/api/generated/core/ApiError';
import {
  acceptList,
  MAX_UPLOAD_BYTES,
  refusedProblem,
  UPLOAD_TYPES,
  uploadExtension,
  uploadProblem,
  UploadRefused,
} from '../src/lib/upload-policy';

test("the app's list is the API's list, with the same size limit", () => {
  assert.deepEqual(UPLOAD_TYPES, apiPolicy.UPLOAD_CONTENT_TYPES);
  assert.equal(MAX_UPLOAD_BYTES, apiPolicy.MAX_UPLOAD_BYTES);
});

test('regression (review): no SVG anywhere, and jfif and jpe are JPEG', () => {
  assert.equal(UPLOAD_TYPES.svg, undefined);
  assert.doesNotMatch(acceptList('file'), /svg/);
  assert.equal(UPLOAD_TYPES.jfif, 'image/jpeg');
  assert.equal(UPLOAD_TYPES.jpe, 'image/jpeg');
  assert.match(acceptList('image'), /(^|,)\.jfif(,|$)/);
});

test('accept lists: images only for photos and posters, documents too for a file answer', () => {
  const image = acceptList('image').split(',');
  const file = acceptList('file').split(',');
  for (const a of ['.jpg', '.png', '.heic', 'image/jpeg', 'image/webp'])
    assert.ok(image.includes(a), a);
  for (const a of ['.pdf', '.docx', 'application/pdf'])
    assert.ok(!image.includes(a) && file.includes(a), a);
  assert.equal(new Set(file).size, file.length);
});

test('a file is checked by its extension, or by its type when it has none', () => {
  const f = (name: string, type = '', size = 100) => ({ name, type, size });
  assert.equal(uploadExtension(f('CV Nadia.PDF'), 'file'), 'pdf');
  assert.equal(uploadExtension(f('foto.JFIF', 'image/jpeg'), 'image'), 'jfif');
  assert.equal(uploadExtension(f('foto', 'image/png'), 'image'), 'png');
  assert.equal(uploadExtension(f('foto', 'image/jpeg'), 'image'), 'jpg');
  assert.equal(uploadExtension(f('cv.pdf'), 'image'), undefined);
  assert.equal(uploadProblem(f('logo.svg', 'image/svg+xml'), 'image'), 'jenis');
  assert.equal(uploadProblem(f('tanpa-ekstensi'), 'file'), 'jenis');
  assert.equal(uploadProblem(f('a.exe'), 'file'), 'jenis');
  assert.equal(
    uploadProblem(f('a.pdf', '', MAX_UPLOAD_BYTES + 1), 'file'),
    'ukuran',
  );
  assert.equal(uploadProblem(f('a.pdf', '', 0), 'file'), 'ukuran');
  assert.equal(uploadProblem(f('a.pdf', '', MAX_UPLOAD_BYTES), 'file'), null);
});

test("the API's refusals are told apart from other failures", () => {
  const api = (status: number, body: unknown) =>
    new ApiError(
      { method: 'POST', url: '/api/media/upload' },
      { url: '/api/media/upload', ok: false, status, statusText: '', body },
      'refused',
    );
  assert.equal(
    refusedProblem(api(400, { error: 'File type not allowed' })),
    'jenis',
  );
  assert.equal(
    refusedProblem(
      api(400, {
        errors: { formErrors: [], fieldErrors: { fileSize: ['x'] } },
      }),
    ),
    'ukuran',
  );
  assert.equal(refusedProblem(new UploadRefused('ukuran')), 'ukuran');
  assert.equal(
    refusedProblem(api(500, { error: 'Something went wrong' })),
    null,
  );
  assert.equal(refusedProblem(api(401, { error: 'Unauthorized' })), null);
  assert.equal(refusedProblem(new Error('upload failed')), null);
});
