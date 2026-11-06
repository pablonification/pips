/**
 * What `POST /media/upload` signs. Only the kinds of file the web app uploads: images (Pengumuman's photos, Info
 * Lomba's poster, both `accept="image/*"`) and the documents a SPARTA file answer carries (a CV, a portfolio). The
 * content type comes from the extension and is part of the signature, so storage serves the file as that type and
 * nothing else (never HTML or script).
 */
export const UPLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  zip: 'application/zip',
};

/** The largest file signed, in bytes (25 MiB): above any phone photo or a portfolio PDF. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The content type for an extension, or undefined when it isn't allowed. */
export function uploadContentType(fileType: string) {
  const ext = fileType.trim().toLowerCase();
  return Object.hasOwn(UPLOAD_CONTENT_TYPES, ext)
    ? UPLOAD_CONTENT_TYPES[ext]
    : undefined;
}

/**
 * The stored file's key, `<id>-<name>.<ext>`: the name kept to letters, digits, `_` and `-` (no dot, slash or
 * anything a path or an address would read), at most 60 characters. media.repo.ts reads the name and type back
 * from it.
 */
export function uploadKey(id: string, fileName: string, fileType: string) {
  const name =
    fileName
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file';
  return `${id}-${name}.${fileType.trim().toLowerCase()}`;
}
