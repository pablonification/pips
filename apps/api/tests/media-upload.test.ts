import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { callRouter } from './support/router';
import { testUser } from './support/session';

// Signing is local (placeholder storage keys), so the real route runs without storage or a database.
let mediaRouter: typeof import('../src/controllers/media.controller').mediaRouter;
let uploadKey: typeof import('../src/lib/upload-policy').uploadKey;
before(async () => {
  usePlaceholderEnv();
  ({ mediaRouter } = await import('../src/controllers/media.controller'));
  ({ uploadKey } = await import('../src/lib/upload-policy'));
});

const nadia = testUser('u-nadia');
const presign = async (body: unknown) =>
  await callRouter(mediaRouter, nadia, 'POST', '/media/upload', body);

test('an allowed file gets an address signed for its type and its exact size', async () => {
  const res = await presign({
    fileName: 'poster',
    fileType: 'png',
    fileSize: 48213,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.contentType, 'image/png');
  const url = new URL(res.body.presignedUrl);
  assert.deepEqual(
    url.searchParams.get('X-Amz-SignedHeaders')?.split(';').sort(),
    ['content-length', 'content-type', 'host'],
  );
  assert.match(url.pathname, /\/[a-z0-9]+-poster\.png$/);
  assert.match(res.body.mediaUrl, /\/[a-z0-9]+-poster\.png$/);
  assert.equal(res.body.expiresIn, 60);

  for (const [fileType, type] of [
    ['JPG', 'image/jpeg'],
    ['jfif', 'image/jpeg'],
    ['jpe', 'image/jpeg'],
    ['pdf', 'application/pdf'],
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ]) {
    const ok = await presign({ fileName: 'cv', fileType, fileSize: 1000 });
    assert.equal(ok.status, 200, fileType);
    assert.equal(ok.body.contentType, type);
  }
});

test('other file types are refused', async () => {
  for (const fileType of [
    'html',
    'htm',
    'js',
    'exe',
    'xhtml',
    'svg',
    'SVG',
    'svgz',
    'png/../x',
    '',
    'constructor',
    'toString',
  ]) {
    const res = await presign({ fileName: 'x', fileType, fileSize: 10 });
    assert.equal(res.status, 400, fileType);
  }
});

test('a missing, empty or oversized size is refused', async () => {
  for (const fileSize of [undefined, 0, -1, 1.5, 25 * 1024 * 1024 + 1]) {
    const res = await presign({ fileName: 'x', fileType: 'png', fileSize });
    assert.equal(res.status, 400, String(fileSize));
  }
  assert.equal(
    (
      await presign({
        fileName: 'x',
        fileType: 'png',
        fileSize: 25 * 1024 * 1024,
      })
    ).status,
    200,
  );
});

test('the key keeps no path, dot or odd character from the name', async () => {
  assert.equal(
    uploadKey('id1', '../../etc/passwd', 'png'),
    'id1-etc-passwd.png',
  );
  assert.equal(
    uploadKey('id1', 'CV Nadia v2.final', 'PDF'),
    'id1-CV-Nadia-v2-final.pdf',
  );
  assert.equal(uploadKey('id1', '', 'png'), 'id1-file.png');
  assert.equal(
    uploadKey('id1', 'a'.repeat(200), 'png').length,
    'id1-'.length + 60 + 4,
  );
  const res = await presign({
    fileName: 'a/b?c#d',
    fileType: 'png',
    fileSize: 5,
  });
  assert.match(new URL(res.body.presignedUrl).pathname, /-a-b-c-d\.png$/);
});

test('signed out, nothing is signed', async () => {
  const res = await callRouter(mediaRouter, null, 'POST', '/media/upload', {
    fileName: 'x',
    fileType: 'png',
    fileSize: 5,
  });
  assert.equal(res.status, 401);
});

test('an SVG is never signed, since it can carry a script that runs on the media domain', async () => {
  const res = await presign({
    fileName: 'poster',
    fileType: 'svg',
    fileSize: 500,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.presignedUrl, undefined);
});

test('the upload address carries no checksum of an empty body, which storage would refuse', async () => {
  const res = await presign({
    fileName: 'poster',
    fileType: 'png',
    fileSize: 48213,
  });
  assert.equal(res.status, 200);
  const url = new URL(res.body.presignedUrl);
  const checksums = [...url.searchParams.keys()].filter((k) =>
    k.toLowerCase().startsWith('x-amz-checksum'),
  );
  assert.deepEqual(checksums, []);
  assert.equal(url.searchParams.get('x-amz-sdk-checksum-algorithm'), null);
  // Still signed for exactly this type and size.
  assert.deepEqual(
    url.searchParams.get('X-Amz-SignedHeaders')?.split(';').sort(),
    ['content-length', 'content-type', 'host'],
  );
});

test('a refusal says which: the type, or the size (the web app tells the member)', async () => {
  const type = await presign({ fileName: 'x', fileType: 'exe', fileSize: 10 });
  assert.deepEqual(type.body, { error: 'File type not allowed' });
  const size = await presign({
    fileName: 'x',
    fileType: 'pdf',
    fileSize: 25 * 1024 * 1024 + 1,
  });
  assert.ok(size.body.errors.fieldErrors.fileSize);
});
