import { api } from '~/api/client';
import { presignBody } from './upload-name';
import {
  refusedProblem,
  uploadExtension,
  uploadProblem,
  UploadRefused,
  type UploadKind,
} from './upload-policy';

/**
 * How long an upload may go without progress. A big file on weak wifi can take minutes, so the limit is on silence,
 * not on the whole upload: any bytes sent (or the answer arriving) start it again.
 */
export const UPLOAD_STALL_MS = 30_000;

/**
 * PUTs a file to a storage address with progress. It fails when the storage answers an error, the connection drops,
 * `signal` aborts it, or nothing moves for `stallMs`.
 */
export function putFile(
  url: string,
  file: File,
  options: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
    contentType?: string;
    stallMs?: number;
  } = {},
): Promise<void> {
  const stallMs = options.stallMs ?? UPLOAD_STALL_MS;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stalled = false;
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, stallMs);
    };
    const end = () => clearTimeout(timer);
    xhr.open('PUT', url);
    if (options.contentType)
      xhr.setRequestHeader('Content-Type', options.contentType);
    xhr.upload.onprogress = (e) => {
      watch();
      if (e.lengthComputable)
        options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onprogress = watch;
    xhr.onload = () => {
      end();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload ${xhr.status}`));
    };
    xhr.onerror = () => {
      end();
      reject(new Error('upload failed'));
    };
    xhr.onabort = () => {
      end();
      reject(new Error(stalled ? 'upload stalled' : 'upload aborted'));
    };
    options.signal?.addEventListener('abort', () => xhr.abort());
    watch();
    xhr.send(file);
  });
}

/**
 * An upload, shared by Pengumuman's photos, Info Lomba's poster (images) and SPARTA's file answers: check the file's
 * type and size here, ask for an upload address just before sending (it expires in 60 s), then PUT the file with
 * progress. Resolves to the file's address; rejects with `UploadRefused` when the type or size isn't allowed (here or
 * by the API), so the screen can say which.
 */
export async function uploadMedia(
  file: File,
  kind: UploadKind,
  onProgress: (percent: number) => void = () => undefined,
  signal?: AbortSignal,
): Promise<string> {
  const problem = uploadProblem(file, kind);
  if (problem) throw new UploadRefused(problem);
  let presigned;
  try {
    presigned = await api.media.createPresignedUrl({
      requestBody: {
        ...presignBody(file),
        fileType: uploadExtension(file, kind)!,
      },
    });
  } catch (err) {
    const refused = refusedProblem(err);
    throw refused ? new UploadRefused(refused) : err;
  }
  const { presignedUrl, mediaUrl, contentType } = presigned;
  // The address is signed for this type (and the file's size, which the browser sends as it is).
  await putFile(presignedUrl, file, { onProgress, signal, contentType });
  onProgress(100);
  return mediaUrl;
}

/** An image upload: Pengumuman's photos and Info Lomba's poster. */
export const uploadImage = (
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) => uploadMedia(file, 'image', onProgress, signal);
