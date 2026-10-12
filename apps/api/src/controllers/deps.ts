import { db, type Database } from '~/db/drizzle';

/** A repository function without its leading `db` argument: how controllers take their storage, so route tests can pass fakes. */
export type WithoutDb<F> = F extends (db: Database, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/** Binds a repository function to the app's database. */
export const withDb =
  <A extends unknown[], R>(f: (db: Database, ...args: A) => R) =>
  (...args: A) =>
    f(db, ...args);
