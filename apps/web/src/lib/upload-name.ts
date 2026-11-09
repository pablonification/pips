/**
 * What `POST /media/upload` is told about a file: its name without the extension, and the extension. The API stores it
 * as `<id>-<fileName>.<fileType>`, and when a post or a competition links it, takes the media's name and type from
 * that address's last part (`apps/api/src/repositories/media.repo.ts`). So neither may carry a dot or a slash: a MIME
 * type ("image/png") as the type left the type empty, and the post or competition couldn't be saved. The size is
 * signed into the upload address.
 */
export function presignBody(file: {
  name: string;
  type: string;
  size: number;
}): {
  fileName: string;
  fileType: string;
  fileSize: number;
} {
  const dot = file.name.lastIndexOf('.');
  const base = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot + 1) : '';
  const fromMime = file.type.split('/')[1]?.split('+')[0] ?? '';
  return {
    fileName:
      base
        .replace(/[^\w-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'gambar',
    fileType:
      (ext || fromMime).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg',
    // The API signs the upload for exactly this many bytes.
    fileSize: file.size,
  };
}
