import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '~/configs/env.config';

const S3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * An upload address for exactly one file: its type and its size are signed, so storage refuses a PUT with another
 * `Content-Type` or another length.
 */
export const createPutObjectPresignedUrl = async (
  key: string,
  expiresIn: number,
  file: { contentType: string; contentLength: number },
) => {
  return await getSignedUrl(
    S3,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: file.contentType,
      ContentLength: file.contentLength,
    }),
    {
      expiresIn,
      signableHeaders: new Set(['content-type', 'content-length']),
    },
  );
};

export const createGetObjectPresignedUrl = async (key: string) => {
  return await getSignedUrl(
    S3,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
};

// getObjectPresignedUrl('test.txt')
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// S3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME }))
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   });
