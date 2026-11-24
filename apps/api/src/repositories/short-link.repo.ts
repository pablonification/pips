import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '~/db/drizzle';
import {
  forms,
  shortLinkAccounts,
  shortLinkClaimLocks,
  shortLinkNames,
  shortLinks,
  users,
} from '~/db/schema';
import { postgresError } from '~/lib/database-error';
import { escapeLike } from '~/lib/nim-finder';
import {
  countTry,
  giveBackTry,
  lockedUntil,
  type ClaimLock,
  type NameHeld,
  type RedirectRow,
} from '~/lib/short-link';

/** The first row, or null: a destructured `[row]` is typed as always there. */
const first = <T>(rows: T[]): T | null => rows[0] ?? null;

/** A name another link or form holds (or a deleted one held), refused by the names' unique indexes. */
export class NameTakenError extends Error {
  constructor() {
    super('Name taken');
  }
}

const isUniqueViolation = (err: unknown) =>
  postgresError(err)?.code === '23505';

// The redirect: one indexed lookup.

/** Every row whose name is one of `candidates`, exactly or without capitals, with what its link leads to. */
export async function findRedirectRows(
  db: Database,
  candidates: readonly string[],
): Promise<RedirectRow[]> {
  if (candidates.length === 0) return [];
  const folded = candidates.map((c) => c.toLowerCase());
  return await db
    .select({
      name: shortLinkNames.name,
      folded: shortLinkNames.folded,
      linkId: shortLinks.id,
      destination: shortLinks.destination,
      formId: shortLinks.formId,
      formName: forms.slug,
      deleted: sql<boolean>`${shortLinks.deletedAt} is not null`,
    })
    .from(shortLinkNames)
    .innerJoin(shortLinks, eq(shortLinks.id, shortLinkNames.linkId))
    .leftJoin(forms, eq(forms.id, shortLinks.formId))
    .where(
      or(
        inArray(shortLinkNames.name, [...candidates]),
        inArray(shortLinkNames.folded, folded),
      ),
    )
    .limit(20);
}

/** Adds clicks counted since the last flush, one statement for all of them. */
export async function addClicks(db: Database, counts: Map<string, number>) {
  if (counts.size === 0) return;
  const values = sql.join(
    [...counts].map(([id, n]) => sql`(${id}, ${n}::int)`),
    sql`, `,
  );
  await db.execute(sql`
    update short_links set clicks = short_links.clicks + c.n
    from (values ${values}) as c(id, n)
    where short_links.id = c.id`);
}

// Names.

export interface NameHolder {
  held: NameHeld;
  /** The name as the other link or form holds it, capitals and all. */
  heldAs: string;
  heldBy: 'link' | 'form';
}

/**
 * Who holds `name` without regard to capitals, apart from the link `exceptLinkId` (renaming a link back to one of its
 * own names is allowed), or the link of form `exceptFormId`. Null when it's free.
 */
export async function nameHolder(
  db: Database,
  name: string,
  except: { linkId?: string | null; formId?: string | null } = {},
): Promise<NameHolder | null> {
  const conditions: SQL[] = [eq(shortLinkNames.folded, name.toLowerCase())];
  if (except.linkId) conditions.push(ne(shortLinks.id, except.linkId));
  if (except.formId)
    conditions.push(
      sql`${shortLinks.formId} is distinct from ${except.formId}`,
    );
  const rows = await db
    .select({
      name: shortLinkNames.name,
      deleted: sql<boolean>`${shortLinks.deletedAt} is not null`,
      formId: shortLinks.formId,
    })
    .from(shortLinkNames)
    .innerJoin(shortLinks, eq(shortLinks.id, shortLinkNames.linkId))
    .where(and(...conditions))
    .orderBy(
      sql`${shortLinks.deletedAt} is not null`,
      desc(shortLinkNames.holdsFold),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.deleted) return { held: 'used', heldAs: row.name, heldBy: 'link' };
  return {
    held: 'taken',
    heldAs: row.name,
    heldBy: row.formId ? 'form' : 'link',
  };
}

/** Whether any link or form, apart from form `exceptFormId`'s own link, holds this name (forms' auto names). */
export async function formNameTaken(
  db: Database,
  name: string,
  exceptFormId: string | null,
) {
  return (await nameHolder(db, name, { formId: exceptFormId })) !== null;
}

/** The form a name opens: its current name or an older one, exactly first, then the one match without capitals. */
export async function formIdByName(db: Database, name: string) {
  const rows = await db
    .select({
      name: shortLinkNames.name,
      formId: shortLinks.formId,
    })
    .from(shortLinkNames)
    .innerJoin(shortLinks, eq(shortLinks.id, shortLinkNames.linkId))
    .where(
      and(
        or(
          eq(shortLinkNames.name, name),
          eq(shortLinkNames.folded, name.toLowerCase()),
        ),
        isNotNull(shortLinks.formId),
        isNull(shortLinks.deletedAt),
      ),
    )
    .limit(5);
  const exact = rows.find((r) => r.name === name);
  if (exact) return exact.formId;
  const ids = new Set(rows.map((r) => r.formId));
  return ids.size === 1 ? rows[0].formId : null;
}

async function setName(
  db: Database,
  linkId: string,
  name: string,
  keepOld: boolean,
) {
  try {
    await db.execute(
      sql`select short_link_set_name(${linkId}, ${name}, ${keepOld})`,
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new NameTakenError();
    throw err;
  }
}

// One member's links, and every link for admin.

export interface LinkListQuery {
  search?: string;
  order: 'new' | 'clicks';
  limit: number;
  offset: number;
}

const owner = aliasedTable(users, 'owner');
const formMaker = aliasedTable(users, 'form_maker');

const listColumns = {
  id: shortLinks.id,
  name: shortLinkNames.name,
  destination: shortLinks.destination,
  formId: shortLinks.formId,
  formTitle: forms.title,
  clicks: shortLinks.clicks,
  createdAt:
    sql<Date>`coalesce(${forms.publishedAt}, ${shortLinks.createdAt})`.mapWith(
      (v: string | Date) => new Date(v),
    ),
  updatedAt: shortLinks.updatedAt,
  total: sql<number>`count(*) over ()`.mapWith(Number),
};

function listOrder(order: LinkListQuery['order']) {
  const made = sql`coalesce(${forms.publishedAt}, ${shortLinks.createdAt})`;
  return order === 'clicks'
    ? [desc(shortLinks.clicks), desc(made), asc(shortLinks.id)]
    : [desc(made), asc(shortLinks.id)];
}

/** A published form's link, or a short link: never a draft's. */
const live = sql`${shortLinks.deletedAt} is null and (${shortLinks.formId} is null or ${forms.publishedAt} is not null)`;

/** Links the member holds, and the links of the forms they made and published. */
export async function listMemberLinks(
  db: Database,
  userId: string,
  q: LinkListQuery,
) {
  const pattern = q.search ? `%${escapeLike(q.search.trim())}%` : null;
  const rows = await db
    .select(listColumns)
    .from(shortLinks)
    .innerJoin(
      shortLinkNames,
      and(
        eq(shortLinkNames.linkId, shortLinks.id),
        eq(shortLinkNames.isCurrent, true),
      ),
    )
    .leftJoin(forms, eq(forms.id, shortLinks.formId))
    .where(
      and(
        live,
        or(eq(shortLinks.ownerId, userId), eq(forms.ownerId, userId)),
        pattern
          ? or(
              ilike(shortLinkNames.name, pattern),
              ilike(shortLinks.destination, pattern),
              ilike(forms.title, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(...listOrder(q.order))
    .limit(q.limit)
    .offset(q.offset);
  return { rows, total: rows[0]?.total ?? (q.offset > 0 ? null : 0) };
}

export interface AdminListQuery extends LinkListQuery {
  view: 'all' | 'unclaimed';
}

/** Every link with its holder (a member, or the old account not yet claimed), for admin. */
export async function listAllLinks(db: Database, q: AdminListQuery) {
  const pattern = q.search ? `%${escapeLike(q.search.trim())}%` : null;
  const where = and(
    live,
    q.view === 'unclaimed'
      ? and(isNull(shortLinks.formId), isNull(shortLinks.ownerId))
      : undefined,
    pattern
      ? or(
          ilike(shortLinkNames.name, pattern),
          ilike(shortLinks.destination, pattern),
          ilike(forms.title, pattern),
          ilike(owner.fullName, pattern),
          ilike(owner.nim, pattern),
          ilike(formMaker.fullName, pattern),
          ilike(formMaker.nim, pattern),
          ilike(shortLinkAccounts.username, pattern),
        )
      : undefined,
  );
  const base = () =>
    db
      .select({
        ...listColumns,
        ownerId: sql<string | null>`coalesce(${owner.id}, ${formMaker.id})`,
        ownerName: sql<
          string | null
        >`coalesce(${owner.fullName}, ${formMaker.fullName})`,
        ownerNim: sql<string | null>`coalesce(${owner.nim}, ${formMaker.nim})`,
        accountId: shortLinkAccounts.id,
        accountUsername: shortLinkAccounts.username,
      })
      .from(shortLinks)
      .innerJoin(
        shortLinkNames,
        and(
          eq(shortLinkNames.linkId, shortLinks.id),
          eq(shortLinkNames.isCurrent, true),
        ),
      )
      .leftJoin(forms, eq(forms.id, shortLinks.formId))
      .leftJoin(owner, eq(owner.id, shortLinks.ownerId))
      .leftJoin(formMaker, eq(formMaker.id, forms.ownerId))
      .leftJoin(
        shortLinkAccounts,
        eq(shortLinkAccounts.id, shortLinks.accountId),
      );
  const rows = await base()
    .where(where)
    .orderBy(...listOrder(q.order))
    .limit(q.limit)
    .offset(q.offset);
  let accounts: number | null = null;
  if (q.view === 'unclaimed') {
    const [row] = await db
      .select({
        n: sql<number>`count(distinct ${shortLinks.accountId})`.mapWith(Number),
      })
      .from(shortLinks)
      .innerJoin(
        shortLinkNames,
        and(
          eq(shortLinkNames.linkId, shortLinks.id),
          eq(shortLinkNames.isCurrent, true),
        ),
      )
      .leftJoin(forms, eq(forms.id, shortLinks.formId))
      .leftJoin(owner, eq(owner.id, shortLinks.ownerId))
      .leftJoin(formMaker, eq(formMaker.id, forms.ownerId))
      .leftJoin(
        shortLinkAccounts,
        eq(shortLinkAccounts.id, shortLinks.accountId),
      )
      .where(where);
    accounts = row?.n ?? 0;
  }
  return { rows, total: rows[0]?.total ?? (q.offset > 0 ? null : 0), accounts };
}

/** Counts only, when a page past the end came back empty. */
export async function countMemberLinks(db: Database, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(shortLinks)
    .leftJoin(forms, eq(forms.id, shortLinks.formId))
    .where(
      and(live, or(eq(shortLinks.ownerId, userId), eq(forms.ownerId, userId))),
    );
  return row?.n ?? 0;
}

// One link.

/** A link with everything its page shows: names, form, holder, the old account and how many links it still has. */
export async function getLink(db: Database, id: string) {
  const [row] = await db
    .select({
      id: shortLinks.id,
      destination: shortLinks.destination,
      formId: shortLinks.formId,
      formTitle: forms.title,
      formOwnerId: forms.ownerId,
      formPublished: sql<boolean>`${forms.publishedAt} is not null`,
      ownerId: shortLinks.ownerId,
      previousOwnerId: shortLinks.previousOwnerId,
      accountId: shortLinks.accountId,
      clicks: shortLinks.clicks,
      createdAt:
        sql<Date>`coalesce(${forms.publishedAt}, ${shortLinks.createdAt})`.mapWith(
          (v: string | Date) => new Date(v),
        ),
      updatedAt: shortLinks.updatedAt,
      deletedAt: shortLinks.deletedAt,
    })
    .from(shortLinks)
    .leftJoin(forms, eq(forms.id, shortLinks.formId))
    .where(eq(shortLinks.id, id));
  if (!row) return null;
  const names = await db
    .select({
      name: shortLinkNames.name,
      isCurrent: shortLinkNames.isCurrent,
      createdAt: shortLinkNames.createdAt,
    })
    .from(shortLinkNames)
    .where(eq(shortLinkNames.linkId, id))
    .orderBy(desc(shortLinkNames.createdAt), desc(shortLinkNames.name));
  const current = names.find((n) => n.isCurrent)?.name ?? names[0]?.name ?? '';
  return {
    ...row,
    name: current,
    olderNames: names.filter((n) => !n.isCurrent).map((n) => n.name),
  };
}

export type LinkRow = NonNullable<Awaited<ReturnType<typeof getLink>>>;

/** A member as an admin's list shows them. */
export async function getPerson(db: Database, userId: string) {
  const [row] = await db
    .select({ id: users.id, fullName: users.fullName, nim: users.nim })
    .from(users)
    .where(eq(users.id, userId));
  return first(row ? [row] : []);
}

export async function getMemberByNim(db: Database, nim: string) {
  const [row] = await db
    .select({ id: users.id, fullName: users.fullName, nim: users.nim })
    .from(users)
    .where(eq(users.nim, nim));
  return first(row ? [row] : []);
}

export async function getAccount(db: Database, accountId: string) {
  const [row] = await db
    .select()
    .from(shortLinkAccounts)
    .where(eq(shortLinkAccounts.id, accountId));
  return first(row ? [row] : []);
}

/** An old account's links nobody in PIPS! holds yet: what claiming it moves. */
export async function unclaimedAccountLinks(db: Database, accountId: string) {
  return await db
    .select({
      id: shortLinks.id,
      name: shortLinkNames.name,
      destination: shortLinks.destination,
      clicks: shortLinks.clicks,
    })
    .from(shortLinks)
    .innerJoin(
      shortLinkNames,
      and(
        eq(shortLinkNames.linkId, shortLinks.id),
        eq(shortLinkNames.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(shortLinks.accountId, accountId),
        isNull(shortLinks.ownerId),
        isNull(shortLinks.deletedAt),
        isNull(shortLinks.formId),
      ),
    )
    .orderBy(desc(shortLinks.createdAt), asc(shortLinks.id));
}

/** Makes a link and gives it its first name, in one go; `NameTakenError` when the name went to someone else first. */
export async function createLink(
  db: Database,
  input: { destination: string; ownerId: string; name: string },
) {
  return await db.transaction(async (tx) => {
    const [link] = await tx
      .insert(shortLinks)
      .values({ destination: input.destination, ownerId: input.ownerId })
      .returning({ id: shortLinks.id });
    await setName(tx, link.id, input.name, false);
    return link.id;
  });
}

export async function setDestination(
  db: Database,
  id: string,
  destination: string,
) {
  await db
    .update(shortLinks)
    .set({ destination, updatedAt: new Date() })
    .where(eq(shortLinks.id, id));
}

/** A new name; the old one stays and keeps working. */
export async function renameLink(db: Database, id: string, name: string) {
  await db.transaction(async (tx) => {
    await setName(tx, id, name, true);
    await tx
      .update(shortLinks)
      .set({ updatedAt: new Date() })
      .where(eq(shortLinks.id, id));
  });
}

/** Deleted for good: it stops redirecting, and its names stay reserved. */
export async function deleteLink(db: Database, id: string) {
  const now = new Date();
  await db
    .update(shortLinks)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(shortLinks.id, id), isNull(shortLinks.deletedAt)));
}

/**
 * Gives a link to a member (an admin's Berikan or Pindahkan), and with `withAccount` every other link of its old
 * account nobody holds yet; that account then counts as claimed by them. Returns how many links moved.
 */
export async function giveLink(
  db: Database,
  input: { linkId: string; toUserId: string; withAccount: boolean },
) {
  return await db.transaction(async (tx) => {
    const [link] = await tx
      .select({ ownerId: shortLinks.ownerId, accountId: shortLinks.accountId })
      .from(shortLinks)
      .where(eq(shortLinks.id, input.linkId))
      .for('update');
    if (!link) return 0;
    const now = new Date();
    await tx
      .update(shortLinks)
      .set({
        ownerId: input.toUserId,
        previousOwnerId:
          link.ownerId && link.ownerId !== input.toUserId ? link.ownerId : null,
        updatedAt: now,
      })
      .where(eq(shortLinks.id, input.linkId));
    let moved = 1;
    if (input.withAccount && link.accountId) {
      const others = await tx
        .update(shortLinks)
        .set({ ownerId: input.toUserId, updatedAt: now })
        .where(
          and(
            eq(shortLinks.accountId, link.accountId),
            isNull(shortLinks.ownerId),
            isNull(shortLinks.deletedAt),
            ne(shortLinks.id, input.linkId),
          ),
        )
        .returning({ id: shortLinks.id });
      moved += others.length;
      await tx
        .update(shortLinkAccounts)
        .set({
          claimedBy: input.toUserId,
          claimedAt: now,
          claimedVia: 'admin',
          updatedAt: now,
        })
        .where(
          and(
            eq(shortLinkAccounts.id, link.accountId),
            isNull(shortLinkAccounts.claimedBy),
          ),
        );
    }
    return moved;
  });
}

// Old accounts: matching a member and claiming.

/** Accounts whose username or email is `login`, without regard to capitals: usernames first. */
export async function findAccountsByLogin(db: Database, login: string) {
  const l = login.trim().toLowerCase();
  if (!l) return [];
  return await db
    .select()
    .from(shortLinkAccounts)
    .where(
      or(
        sql`lower(${shortLinkAccounts.username}) = ${l}`,
        sql`lower(${shortLinkAccounts.email}) = ${l}`,
      ),
    )
    .orderBy(
      sql`lower(${shortLinkAccounts.username}) = ${l} desc`,
      asc(shortLinkAccounts.createdAt),
    )
    .limit(5);
}

/**
 * Makes an old account the member's and moves every link of it nobody holds yet. Null when someone claimed it first
 * (nothing moves); otherwise how many links moved.
 */
export async function claimAccount(
  db: Database,
  input: {
    accountId: string;
    userId: string;
    via: 'email' | 'nim' | 'password' | 'admin';
  },
) {
  return await db.transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx
      .update(shortLinkAccounts)
      .set({
        claimedBy: input.userId,
        claimedAt: now,
        claimedVia: input.via,
        updatedAt: now,
      })
      .where(
        and(
          eq(shortLinkAccounts.id, input.accountId),
          isNull(shortLinkAccounts.claimedBy),
        ),
      )
      .returning({ id: shortLinkAccounts.id });
    if (claimed.length === 0) return null;
    const moved = await tx
      .update(shortLinks)
      .set({ ownerId: input.userId, updatedAt: now })
      .where(
        and(
          eq(shortLinks.accountId, input.accountId),
          isNull(shortLinks.ownerId),
          isNull(shortLinks.deletedAt),
        ),
      )
      .returning({ id: shortLinks.id });
    return moved.length;
  });
}

/**
 * Attaches the member's old accounts nobody claimed yet: by their student email, then by their NIM found in an old
 * email or username. Returns how many links moved. Safe to run at every sign-in.
 */
export async function matchMemberAccounts(
  db: Database,
  member: { id: string; email: string; nim: string },
) {
  const found = await db
    .select({
      id: shortLinkAccounts.id,
      byEmail: sql<boolean>`lower(${shortLinkAccounts.email}) = ${member.email.toLowerCase()}`,
    })
    .from(shortLinkAccounts)
    .where(
      and(
        isNull(shortLinkAccounts.claimedBy),
        or(
          sql`lower(${shortLinkAccounts.email}) = ${member.email.toLowerCase()}`,
          eq(shortLinkAccounts.nim, member.nim),
        ),
      ),
    );
  let moved = 0;
  for (const a of found) {
    moved +=
      (await claimAccount(db, {
        accountId: a.id,
        userId: member.id,
        via: a.byEmail ? 'email' : 'nim',
      })) ?? 0;
  }
  return moved;
}

// The claim's locks.

/**
 * Counts one try against every key before its password is compared, under row locks taken in one order, so tries
 * sent at once are counted one after another and none passes the limit. Counts nothing and answers `locked` (the
 * latest time) when any key is locked now.
 */
export async function reserveClaimTry(
  db: Database,
  keys: string[],
  now: Date,
): Promise<{ locked: Date } | { locks: Map<string, ClaimLock> }> {
  const sorted = [...new Set(keys)].sort();
  return await db.transaction(async (tx) => {
    const rows = new Map<string, ClaimLock>();
    for (const key of sorted) {
      await tx
        .insert(shortLinkClaimLocks)
        .values({ key, tries: 0, lastTryAt: new Date(0) })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(shortLinkClaimLocks)
        .where(eq(shortLinkClaimLocks.key, key))
        .for('update');
      rows.set(key, row);
    }
    let locked: Date | undefined;
    for (const row of rows.values()) {
      const until = lockedUntil(row, now);
      if (until && (!locked || until > locked)) locked = until;
    }
    if (locked) return { locked };
    const out = new Map<string, ClaimLock>();
    for (const [key, row] of rows) {
      const next = countTry(row.lastTryAt.getTime() === 0 ? null : row, now);
      await tx
        .update(shortLinkClaimLocks)
        .set(next)
        .where(eq(shortLinkClaimLocks.key, key));
      out.set(key, next);
    }
    return { locks: out };
  });
}

/** Gives back the try {@link reserveClaimTry} counted, once its password was right. */
export async function giveBackClaimTry(db: Database, keys: string[]) {
  const sorted = [...new Set(keys)].sort();
  await db.transaction(async (tx) => {
    for (const key of sorted) {
      const [row] = await tx
        .select()
        .from(shortLinkClaimLocks)
        .where(eq(shortLinkClaimLocks.key, key))
        .for('update');
      if (!row) continue;
      const next = giveBackTry(row);
      if (next)
        await tx
          .update(shortLinkClaimLocks)
          .set(next)
          .where(eq(shortLinkClaimLocks.key, key));
      else
        await tx
          .delete(shortLinkClaimLocks)
          .where(eq(shortLinkClaimLocks.key, key));
    }
  });
}

/** The cost in a bcrypt hash, as a POSIX pattern for `substring … from`: `$2b$15$…` gives 15. */
const BCRYPT_COST = '^\\$2[abxy]?\\$([0-9]{2})\\$';

/**
 * The most common cost among the old accounts' password hashes (the higher on a tie), or null when none is left. An
 * unknown login is compared at this cost, so it answers as slowly as most real accounts.
 */
export async function commonHashCost(db: Database) {
  const [row] = await db
    .select({
      cost: sql<number>`substring(${shortLinkAccounts.passwordHash} from ${BCRYPT_COST})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(shortLinkAccounts)
    .where(
      sql`substring(${shortLinkAccounts.passwordHash} from ${BCRYPT_COST}) is not null`,
    )
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`, sql`1 desc`)
    .limit(1);
  return row?.cost ?? null;
}
