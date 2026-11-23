import { and, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from '~/db/drizzle';
import { READ_SCOPE, WRITE_SCOPE, returnHost } from '~/lib/oauth';
import { first } from '~/db/helper';
import {
  type OAuthAuthorization,
  type OAuthToken,
  oauthAuthorizations,
  oauthClients,
  oauthTokens,
} from '~/db/schema';

/** How long expired requests, codes and tokens are kept before they're swept, in ms. */
const KEEP_EXPIRED_MS = 24 * 3600 * 1000;

export async function createClient(
  db: Database,
  client: { id: string; name: string; redirectUris: string[] },
) {
  await db.insert(oauthClients).values(client);
}

export async function findClient(db: Database, id: string) {
  return await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });
}

export async function createAuthorizationRequest(
  db: Database,
  request: Pick<
    OAuthAuthorization,
    | 'requestHash'
    | 'clientId'
    | 'redirectUri'
    | 'scope'
    | 'state'
    | 'codeChallenge'
    | 'expiresAt'
  >,
  now: Date,
) {
  // Swept here, as requests come in: nothing reads a request a day past its end.
  await db
    .delete(oauthAuthorizations)
    .where(
      lt(
        oauthAuthorizations.expiresAt,
        new Date(now.getTime() - KEEP_EXPIRED_MS),
      ),
    );
  await db.insert(oauthAuthorizations).values(request);
}

/** A request still waiting for the member: not decided, not expired. With its client's name. */
export async function findPendingRequest(
  db: Database,
  requestHash: string,
  now: Date,
) {
  return await db
    .select({
      clientName: oauthClients.name,
      redirectUri: oauthAuthorizations.redirectUri,
      scope: oauthAuthorizations.scope,
    })
    .from(oauthAuthorizations)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthAuthorizations.clientId))
    .where(pendingRequest(requestHash, now))
    .then(first);
}

const pendingRequest = (requestHash: string, now: Date) =>
  and(
    eq(oauthAuthorizations.requestHash, requestHash),
    gt(oauthAuthorizations.expiresAt, now),
    isNull(oauthAuthorizations.approvedAt),
    isNull(oauthAuthorizations.deniedAt),
  );

/** Approves a pending request for `userId` and attaches the code. Undefined if it was no longer pending: one decision only. */
export async function approveRequest(
  db: Database,
  input: {
    requestHash: string;
    userId: string;
    /** What the member allowed: the asked scopes or fewer. */
    scope: string;
    codeHash: string;
    codeExpiresAt: Date;
  },
  now: Date,
) {
  return await db
    .update(oauthAuthorizations)
    .set({
      userId: input.userId,
      scope: input.scope,
      approvedAt: now,
      codeHash: input.codeHash,
      codeExpiresAt: input.codeExpiresAt,
    })
    .where(pendingRequest(input.requestHash, now))
    .returning()
    .then(first);
}

/** Denies a pending request. Undefined if it was no longer pending. */
export async function denyRequest(
  db: Database,
  requestHash: string,
  now: Date,
) {
  return await db
    .update(oauthAuthorizations)
    .set({ deniedAt: now })
    .where(pendingRequest(requestHash, now))
    .returning()
    .then(first);
}

export type NewToken = Pick<
  OAuthToken,
  | 'family'
  | 'clientId'
  | 'userId'
  | 'scope'
  | 'accessHash'
  | 'accessExpiresAt'
  | 'refreshHash'
  | 'refreshExpiresAt'
>;

/** What `decide` answers: the token to issue, or why not. */
export type Decision = NewToken | { refuse: string };

export type Exchange =
  | { status: 'ok' }
  | { status: 'refused'; reason: string }
  | { status: 'reused' | 'missing' };

/**
 * Spends a code, once, and issues what `decide` returns for it in the same transaction. The code's row stays locked
 * until the token is written, so a second use waiting on it sees that token and revokes it (RFC 9700 4.3): `reused`.
 */
export async function redeemCode(
  db: Database,
  codeHash: string,
  tokenFamily: string,
  now: Date,
  decide: (authorization: OAuthAuthorization) => Promise<Decision>,
): Promise<Exchange> {
  await sweepTokens(db, now);
  const outcome = await db.transaction(async (tx): Promise<Exchange | null> => {
    const spent = await tx
      .update(oauthAuthorizations)
      .set({ usedAt: now, tokenFamily })
      .where(
        and(
          eq(oauthAuthorizations.codeHash, codeHash),
          isNull(oauthAuthorizations.usedAt),
        ),
      )
      .returning()
      .then(first);
    if (!spent) return null;
    const decision = await decide(spent);
    if ('refuse' in decision)
      return { status: 'refused', reason: decision.refuse };
    await tx.insert(oauthTokens).values({ ...decision, createdAt: now });
    return { status: 'ok' };
  });
  if (outcome) return outcome;
  const used = await db.query.oauthAuthorizations.findFirst({
    where: eq(oauthAuthorizations.codeHash, codeHash),
  });
  if (!used) return { status: 'missing' };
  if (used.tokenFamily) await revokeFamily(db, used.tokenFamily, now);
  return { status: 'reused' };
}

/** Deletes tokens a day past their refresh end: nothing reads them. */
async function sweepTokens(db: Database, now: Date) {
  await db
    .delete(oauthTokens)
    .where(
      lt(
        oauthTokens.refreshExpiresAt,
        new Date(now.getTime() - KEEP_EXPIRED_MS),
      ),
    );
}

/** The token row an access token belongs to, while it is current: not expired, revoked or replaced. */
export async function findActiveAccessToken(
  db: Database,
  accessHash: string,
  now: Date,
) {
  return await db.query.oauthTokens.findFirst({
    where: and(
      eq(oauthTokens.accessHash, accessHash),
      gt(oauthTokens.accessExpiresAt, now),
      isNull(oauthTokens.revokedAt),
      isNull(oauthTokens.rotatedAt),
    ),
  });
}

/**
 * Retires a refresh token, once, and issues what `decide` returns in its place in the same transaction. A refresh
 * token already retired and used again revokes the whole family, the token issued in its place included
 * (RFC 9700 4.14.2): `reused`.
 */
export async function refreshTokens(
  db: Database,
  refreshHash: string,
  now: Date,
  decide: (old: OAuthToken) => Promise<Decision>,
): Promise<Exchange> {
  const outcome = await db.transaction(async (tx): Promise<Exchange | null> => {
    const retired = await tx
      .update(oauthTokens)
      .set({ rotatedAt: now })
      .where(
        and(
          eq(oauthTokens.refreshHash, refreshHash),
          isNull(oauthTokens.rotatedAt),
          isNull(oauthTokens.revokedAt),
          gt(oauthTokens.refreshExpiresAt, now),
        ),
      )
      .returning()
      .then(first);
    if (!retired) return null;
    const decision = await decide(retired);
    if ('refuse' in decision)
      return { status: 'refused', reason: decision.refuse };
    await tx.insert(oauthTokens).values({ ...decision, createdAt: now });
    return { status: 'ok' };
  });
  if (outcome) return outcome;
  const old = await db.query.oauthTokens.findFirst({
    where: eq(oauthTokens.refreshHash, refreshHash),
  });
  if (!old) return { status: 'missing' };
  if (old.rotatedAt && !old.revokedAt) {
    await revokeFamily(db, old.family, now);
    return { status: 'reused' };
  }
  return { status: 'missing' };
}

export async function revokeFamily(db: Database, family: string, now: Date) {
  await db
    .update(oauthTokens)
    .set({ revokedAt: now })
    .where(and(eq(oauthTokens.family, family), isNull(oauthTokens.revokedAt)));
}

export async function touchToken(db: Database, id: string, now: Date) {
  await db
    .update(oauthTokens)
    .set({ lastUsedAt: now })
    .where(eq(oauthTokens.id, id));
}

/**
 * The apps a member has connected: those with a token family still current. `connectedAt` is the earliest token
 * of those families, `lastUsedAt` the latest use (null when never used).
 */
export async function listConnectedApps(
  db: Database,
  userId: string,
  now: Date,
) {
  const current = db
    .select({ family: oauthTokens.family })
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt),
        isNull(oauthTokens.rotatedAt),
        gt(oauthTokens.refreshExpiresAt, now),
      ),
    );
  const rows = await db
    .select({
      clientId: oauthClients.id,
      name: oauthClients.name,
      redirectUris: oauthClients.redirectUris,
      connectedAt: sql<Date>`min(${oauthTokens.createdAt})`.mapWith(
        (v: string | Date) => new Date(v),
      ),
      lastUsedAt: sql<Date | null>`max(${oauthTokens.lastUsedAt})`.mapWith(
        (v: string | Date | null) => (v === null ? null : new Date(v)),
      ),
      // A current family has one token not yet rotated: the one the app holds now.
      canWrite:
        sql<boolean>`bool_or(${oauthTokens.rotatedAt} is null and ${WRITE_SCOPE} = any(string_to_array(${oauthTokens.scope}, ' ')))`.mapWith(
          Boolean,
        ),
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(
      and(
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt),
        inArray(oauthTokens.family, current),
      ),
    )
    .groupBy(oauthClients.id, oauthClients.name)
    .orderBy(desc(sql`min(${oauthTokens.createdAt})`));
  return rows.map(({ canWrite, redirectUris, ...app }) => ({
    ...app,
    returnHost: returnHost(redirectUris),
    scopes: canWrite ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE],
  }));
}

/** Revokes every token the member gave `clientId`, and any code not yet exchanged. How many tokens were current. */
export async function revokeApp(
  db: Database,
  userId: string,
  clientId: string,
  now: Date,
) {
  return await db.transaction(async (tx) => {
    await tx
      .update(oauthAuthorizations)
      .set({ usedAt: now })
      .where(
        and(
          eq(oauthAuthorizations.userId, userId),
          eq(oauthAuthorizations.clientId, clientId),
          isNull(oauthAuthorizations.usedAt),
        ),
      );
    const revoked = await tx
      .update(oauthTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.clientId, clientId),
          isNull(oauthTokens.revokedAt),
        ),
      )
      .returning({ id: oauthTokens.id });
    return revoked.length;
  });
}
