import { users } from '~/db/schema';

/**
 * What another member gets about the author of a post or a comment: the id (to show your own post's menu), the
 * name and the photo, as the redesign's bylines show them. Nothing else about a member (email, NIM, gender, campus,
 * angkatan, membership, sign-in times) leaves the API through a post, a comment or a reaction (OPEN-QUESTIONS C10).
 */
export interface Author {
  id: string;
  fullName: string;
  picture: string | null;
}

/** The author's columns, for relational queries (`with: { creator: { columns: AUTHOR_COLUMNS } }`). */
export const AUTHOR_COLUMNS = {
  id: true,
  fullName: true,
  picture: true,
} as const;

/** The author's columns, for `select()`. */
export const AUTHOR_SELECT = {
  id: users.id,
  fullName: users.fullName,
  picture: users.picture,
};

/** An allow-list copy of an author: whatever else `user` carries is left behind. */
export function toAuthor(user: Author): Author {
  return {
    id: user.id,
    fullName: user.fullName,
    picture: user.picture ?? null,
  };
}

/** The same item with its `creator` cut down to `toAuthor`. */
export function withAuthor<T extends { creator: Author }>(
  item: T,
): Omit<T, 'creator'> & { creator: Author } {
  return { ...item, creator: toAuthor(item.creator) };
}
