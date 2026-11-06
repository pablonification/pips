import { createPresignedUrl } from '~/routes/media.route';
import { createAuthRouter } from './router-factory';
import { createPutObjectPresignedUrl } from '~/lib/r2-bucket';
import { uploadContentType, uploadKey } from '~/lib/upload-policy';
import { env } from '~/configs/env.config';
import { createId } from '~/db/schema';

export const mediaRouter = createAuthRouter();

mediaRouter.openapi(createPresignedUrl, async (c) => {
  const { fileName, fileType, fileSize } = c.req.valid('json');
  const contentType = uploadContentType(fileType);
  if (!contentType) {
    return c.json({ error: 'File type not allowed' }, 400);
  }
  const key = uploadKey(createId(), fileName, fileType);

  const expiresIn = 60;
  return c.json(
    {
      presignedUrl: await createPutObjectPresignedUrl(key, expiresIn, {
        contentType,
        contentLength: fileSize,
      }),
      mediaUrl: `${env.R2_PUBLIC_URL}/${key}`,
      expiresIn,
      contentType,
    },
    200,
  );
});
