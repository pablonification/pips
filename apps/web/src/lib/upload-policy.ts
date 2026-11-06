/**
 * Which files the API signs an upload for (`apps/api/src/lib/upload-policy.ts`; `tests/upload-policy.test.ts` keeps
 * the two lists the same): the file inputs offer only these, and a file is checked here before anything is sent, so
 * a member hears why a file can't go instead of a bare "failed".
 */
import { ApiError } from '~/api/generated/core/ApiError';

/** Extension → the content type the upload is signed for. No SVG: it can carry a script. */
export const UPLOAD_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
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

/** The largest file the API signs (25 MiB). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Photos and posters take images only; a SPARTA file answer takes any allowed file. */
export type UploadKind = 'image' | 'file';

const allowed = (kind: UploadKind) =>
  Object.entries(UPLOAD_TYPES).filter(
    ([, type]) => kind === 'file' || type.startsWith('image/'),
  );

/** The file input's `accept`: every allowed content type, then every allowed extension. */
export function acceptList(kind: UploadKind) {
  const pairs = allowed(kind);
  return [
    ...new Set(pairs.map(([, type]) => type)),
    ...pairs.map(([ext]) => `.${ext}`),
  ].join(',');
}

/**
 * The extension the upload is signed for: the name's own when it has one, else the one its content type stands for.
 * Undefined when neither is allowed for this kind.
 */
export function uploadExtension(
  file: { name: string; type: string },
  kind: UploadKind,
) {
  const pairs = allowed(kind);
  const dot = file.name.lastIndexOf('.');
  if (dot > 0) {
    const ext = file.name.slice(dot + 1).toLowerCase();
    return pairs.some(([e]) => e === ext) ? ext : undefined;
  }
  const type = file.type.toLowerCase();
  return pairs.find(([, t]) => t === type)?.[0];
}

/** Why a file can't be uploaded: a type the API refuses, or more than 25 MiB. */
export type UploadProblem = 'jenis' | 'ukuran';

/** The problem with a file before it's sent, or null when it can go. */
export function uploadProblem(
  file: { name: string; type: string; size: number },
  kind: UploadKind,
): UploadProblem | null {
  if (!uploadExtension(file, kind)) return 'jenis';
  if (file.size > MAX_UPLOAD_BYTES || file.size <= 0) return 'ukuran';
  return null;
}

/** An upload refused for its type or size, by the check here or by the API. */
export class UploadRefused extends Error {
  constructor(readonly problem: UploadProblem) {
    super(`upload refused: ${problem}`);
    this.name = 'UploadRefused';
  }
}

/**
 * Why the API refused to sign an upload, from its 400: `{ error: 'File type not allowed' }`, or the size failing
 * validation. Null for any other failure (the connection, storage), which stays "failed".
 */
export function refusedProblem(err: unknown): UploadProblem | null {
  if (err instanceof UploadRefused) return err.problem;
  if (!(err instanceof ApiError) || err.status !== 400) return null;
  const body = err.body as {
    error?: unknown;
    errors?: { fieldErrors?: Record<string, unknown> };
  } | null;
  if (body?.error === 'File type not allowed') return 'jenis';
  const fields = body?.errors?.fieldErrors ?? {};
  if ('fileType' in fields) return 'jenis';
  if ('fileSize' in fields) return 'ukuran';
  return null;
}
