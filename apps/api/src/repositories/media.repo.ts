import { Database } from '~/db/drizzle';
import { medias } from '~/db/schema';

// A stored file's address ends in <random id>-<the file's own name>: …/r176r3qcuqs3hg8o3dm93n35-photo.jpg
export const createMediasFromUrl = async (
  db: Database,
  urls: string[],
  creatorId: string,
) => {
  return await db
    .insert(medias)
    .values(
      urls.map((url) => {
        const file = url.split('/').at(-1); // r176r3qcuqs3hg8o3dm93n35-photo.jpg
        if (!file) {
          throw Error('Invalid URL');
        }
        const [name, type] = file.split('.');
        return {
          creatorId,
          name,
          type,
          url,
        };
      }),
    )
    .returning();
};
