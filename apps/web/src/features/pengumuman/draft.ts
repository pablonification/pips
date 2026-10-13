/**
 * The composer's draft shape and a fresh one. On its own so the composer's store (which the route's enter and leave
 * hooks load with the app's first code) needs none of the feature's rules or copy (review minor 6).
 */
export type AudienceKind = 'all' | 'angkatan' | 'group';

export interface Draft {
  title: string;
  body: string;
  /** Category ids. */
  cats: string[];
  audType: AudienceKind;
  /** Angkatan ids (`forAngkatan`) or roles (`forGroups`). */
  aud: string[];
  /** Photos' uploaded URLs, in order (only finished uploads). */
  mediaUrls: string[];
}

export const freshDraft = (): Draft => ({
  title: '',
  body: '',
  cats: [],
  audType: 'all',
  aud: [],
  mediaUrls: [],
});
