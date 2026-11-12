import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '~/configs/env.config';

const S3 = new S3Client({
  region: 'auto',
  // The SDK's default adds a checksum to every request, and to a presigned PUT that is the checksum of an empty
  // body (`x-amz-checksum-crc32=AAAAAA==`), so storage refuses the real file. Only when an operation needs one.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
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

// S3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME }))
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   });
