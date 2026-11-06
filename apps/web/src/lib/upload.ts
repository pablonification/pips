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
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    // The address is signed for this type (and the file's size, which the browser sends as it is).
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.onabort = () => reject(new Error('upload aborted'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
  onProgress(100);
  return mediaUrl;
}

/** An image upload: Pengumuman's photos and Info Lomba's poster. */
export const uploadImage = (
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) => uploadMedia(file, 'image', onProgress, signal);
