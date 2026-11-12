// What POST /media/upload is told about an image (Pengumuman's photos and Info Lomba's poster).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { presignBody } from '../src/lib/upload-name';

test('the name without its extension, and the extension as the type (never the MIME type)', () => {
  // Pengumuman sent { fileName: 'a.png', fileType: 'image/png' }: the stored address ended in "…a.png.image/png", whose
  // last part has no type, so the API couldn't save the post's media.
  assert.deepEqual(presignBody({ name: 'a.png', type: 'image/png', size: 1 }), {
    fileName: 'a',
    fileType: 'png',
    fileSize: 1,
  });
  assert.deepEqual(
    presignBody({ name: 'Poster Hology 8.JPG', type: 'image/jpeg', size: 1 }),
    { fileName: 'Poster-Hology-8', fileType: 'jpg', fileSize: 1 },
  );
});

test('neither part carries a dot, a slash or a space, so the address keeps one name and one type', () => {
  for (const name of [
    'poster.final.v2.png',
    '../../etc/passwd.png',
    'foto lomba (1).webp',
    '.png',
    'gambar',
  ]) {
    const { fileName, fileType } = presignBody({
      name,
      type: 'image/png',
      size: 1,
    });
    assert.match(fileName, /^[\w-]+$/, name);
    assert.match(fileType, /^[a-z0-9]+$/, name);
  }
  assert.deepEqual(
    presignBody({ name: 'poster.final.v2.png', type: '', size: 1 }),
    {
      fileName: 'poster-final-v2',
      fileType: 'png',
      fileSize: 1,
    },
  );
});

test('no extension: the type comes from the MIME type; nothing at all falls back to jpg', () => {
  assert.deepEqual(
    presignBody({ name: 'IMG_1234', type: 'image/jpeg', size: 1 }),
    {
      fileName: 'IMG_1234',
      fileType: 'jpeg',
      fileSize: 1,
    },
  );
  assert.deepEqual(
    presignBody({ name: 'logo', type: 'image/svg+xml', size: 1 }),
    {
      fileName: 'logo',
      fileType: 'svg',
      fileSize: 1,
    },
  );
  assert.deepEqual(presignBody({ name: '', type: '', size: 1 }), {
    fileName: 'gambar',
    fileType: 'jpg',
    fileSize: 1,
  });
});

test("the file's size goes with it: the API signs the upload for exactly that many bytes", () => {
  assert.equal(
    presignBody({ name: 'poster.png', type: 'image/png', size: 48213 })
      .fileSize,
    48213,
  );
});
