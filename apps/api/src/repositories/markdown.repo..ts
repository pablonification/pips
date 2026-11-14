import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { Database } from '~/db/drizzle';
import { markdowns, users } from '~/db/schema';

export const CREDITS_MARKDOWN_ID = 'credits';

export function getMarkdownById(db: Database, id: string) {
  return db.query.markdowns.findFirst({
    where: eq(markdowns.id, id),
  });
}

/**
 * The photos of the members with these student numbers, by student number. Only the photo: NIM Finder already
 * shows it to every member beside the same name and number.
 */
export async function getPicturesByNim(
  db: Database,
  nims: string[],
): Promise<Record<string, string>> {
  if (nims.length === 0) return {};
  const rows = await db
    .select({ nim: users.nim, picture: users.picture })
    .from(users)
    .where(and(inArray(users.nim, nims), isNotNull(users.picture)));
  const photos: Record<string, string> = {};
  for (const row of rows) if (row.picture) photos[row.nim] = row.picture;
  return photos;
}
