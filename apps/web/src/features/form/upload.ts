import { uploadMedia } from '~/lib/upload';

/** Uploads a file answer or a photo into the app's storage; resolves to its address. */
export const uploadAnswerFile = (
  file: File,
  kind: 'file' | 'image',
  onProgress?: (percent: number) => void,
) => uploadMedia(file, kind, onProgress);
