import { asc, ilike, like, or, sql } from 'drizzle-orm';
import { users } from '~/db/schema';

/** NIM Finder shows at most this many members; the closest NIM matches come first, so an exact NIM is never cut. */
export const NIM_FINDER_LIMIT = 30;

/**
 * The only fields NIM Finder returns (SPEC API change 4): name, NIM, programme and photo. Nothing else about a
 * member (id, email, gender, membership, campus, angkatan, sign-in times) leaves the API through it.
 */
export const NIM_FINDER_COLUMNS = {
  fullName: users.fullName,
  nim: users.nim,
  major: users.major,
  picture: users.picture,
};

export interface NimFinderResult {
  fullName: string;
  nim: string;
  major: 'IF' | 'STI';
  picture: string | null;
}

export function toNimFinderResult(row: NimFinderResult): NimFinderResult {
  return {
    fullName: row.fullName,
    nim: row.nim,
    major: row.major,
    picture: row.picture,
  };
}

/** Makes `%`, `_` and `\` match themselves in a LIKE pattern (backslash is Postgres's default escape). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Where and order for a search: a member matches when the NIM or the name contains the text, taken literally.
 * Order: the exact NIM, then NIMs starting with it, then other NIM matches, then name matches; A–Z within each.
 */
export function nimFinderSearch(search: string) {
  const text = escapeLike(search);
  const contains = `%${text}%`;
  return {
    where: or(like(users.nim, contains), ilike(users.fullName, contains)),
    orderBy: [
      sql`case when ${users.nim} = ${search} then 0 when ${users.nim} like ${`${text}%`} then 1 when ${users.nim} like ${contains} then 2 else 3 end`,
      asc(users.fullName),
    ],
  };
}
