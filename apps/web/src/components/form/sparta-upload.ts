import { uploadMedia } from '~/lib/upload';

/**
 * A file answer: a presigned upload (`POST /media/upload`), resolves to the file's URL. The
 * type and size are checked first (`lib/upload-policy.ts`), and a refusal rejects with `UploadRefused`.
 */
export const uploadFile = (file: File) => uploadMedia(file, 'file');
