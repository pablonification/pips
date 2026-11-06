import { api } from '~/api/client';
import { presignBody } from './upload-name';

/**
 * An image upload, shared by Pengumuman's photos and Info Lomba's poster: ask for an upload address just before
 * sending (it expires in 60 s), then PUT the file with progress. Resolves to the image's address.
 */
export async function uploadImage(
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { presignedUrl, mediaUrl, contentType } =
    await api.media.createPresignedUrl({
      requestBody: presignBody(file),
    });
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
