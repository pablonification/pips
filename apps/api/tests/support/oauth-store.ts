import type { OAuthDeps } from '../../src/controllers/oauth.controller';
import type { NewToken } from '../../src/repositories/oauth.repo';
import type {
  OAuthAuthorization,
  OAuthClient,
  OAuthToken,
  User,
} from '../../src/db/schema';

/**
 * OAuth storage in memory, with the same single-use and reuse rules as `repositories/oauth.repo.ts` (whose SQL
 * `tests/db/oauth.test.ts` checks on a real database). `clock` moves time.
 */
export function memoryOAuthStore(users: Record<string, Partial<User>> = {}) {
  const clock = { now: new Date('2026-10-08T06:35:00Z') };
  const clients = new Map<string, OAuthClient>();
  const auths: OAuthAuthorization[] = [];
  const tokens: OAuthToken[] = [];
  let seq = 0;

  const pending = (requestHash: string, now: Date) =>
    auths.find(
      (a) =>
        a.requestHash === requestHash &&
        a.expiresAt > now &&
        !a.approvedAt &&
        !a.deniedAt,
    );
  const revokeFamily = (family: string, now: Date) => {
    for (const t of tokens)
      if (t.family === family && !t.revokedAt) t.revokedAt = now;
  };

  const insertToken = (t: NewToken, now: Date) => {
    tokens.push({
      ...t,
      id: `token-${++seq}`,
      createdAt: now,
      lastUsedAt: null,
      rotatedAt: null,
      revokedAt: null,
    });
  };

  const deps: OAuthDeps = {
    now: () => clock.now,
    createClient: async (c) => {
      clients.set(c.id, { ...c, createdAt: clock.now });
    },
    findClient: async (id) => clients.get(id),
    createAuthorizationRequest: async (r) => {
      auths.push({
        ...r,
        id: `auth-${++seq}`,
        userId: null,
        approvedAt: null,
        deniedAt: null,
        codeHash: null,
        codeExpiresAt: null,
        usedAt: null,
        tokenFamily: null,
        createdAt: clock.now,
      });
    },
    findPendingRequest: async (hash, now) => {
      const a = pending(hash, now);
      if (!a) return undefined;
      return {
        clientName: clients.get(a.clientId)?.name ?? '',
        redirectUri: a.redirectUri,
        scope: a.scope,
      };
    },
    approveRequest: async (input, now) => {
      const a = pending(input.requestHash, now);
      if (!a) return undefined;
      Object.assign(a, {
        userId: input.userId,
        scope: input.scope,
        approvedAt: now,
        codeHash: input.codeHash,
        codeExpiresAt: input.codeExpiresAt,
      });
      return { ...a };
    },
    denyRequest: async (hash, now) => {
      const a = pending(hash, now);
      if (!a) return undefined;
      a.deniedAt = now;
      return { ...a };
    },
    redeemCode: async (codeHash, family, now, decide) => {
      const a = auths.find((x) => x.codeHash === codeHash);
      if (!a) return { status: 'missing' };
      if (a.usedAt) {
        if (a.tokenFamily) revokeFamily(a.tokenFamily, now);
        return { status: 'reused' };
      }
      a.usedAt = now;
      a.tokenFamily = family;
      const decision = await decide({ ...a });
      if ('refuse' in decision)
        return { status: 'refused', reason: decision.refuse };
      insertToken(decision, now);
      return { status: 'ok' };
    },
    findActiveAccessToken: async (hash, now) =>
      tokens.find(
        (t) =>
          t.accessHash === hash &&
          t.accessExpiresAt > now &&
          !t.revokedAt &&
          !t.rotatedAt,
      ),
    refreshTokens: async (hash, now, decide) => {
      const t = tokens.find((x) => x.refreshHash === hash);
      if (!t) return { status: 'missing' };
      if (!t.rotatedAt && !t.revokedAt && t.refreshExpiresAt > now) {
        t.rotatedAt = now;
        const decision = await decide({ ...t });
        if ('refuse' in decision)
          return { status: 'refused', reason: decision.refuse };
        insertToken(decision, now);
        return { status: 'ok' };
      }
      if (t.rotatedAt && !t.revokedAt) {
        revokeFamily(t.family, now);
        return { status: 'reused' };
      }
      return { status: 'missing' };
    },
    touchToken: async (id, now) => {
      const t = tokens.find((x) => x.id === id);
      if (t) t.lastUsedAt = now;
    },
    listConnectedApps: async (userId, now) => {
      const current = new Set(
        tokens
          .filter(
            (t) =>
              t.userId === userId &&
              !t.revokedAt &&
              !t.rotatedAt &&
              t.refreshExpiresAt > now,
          )
          .map((t) => t.family),
      );
      const byClient = new Map<
        string,
        {
          clientId: string;
          name: string;
          connectedAt: Date;
          lastUsedAt: Date | null;
          scopes: Array<'pips.read' | 'pips.write'>;
        }
      >();
      for (const t of tokens) {
        if (t.userId !== userId || t.revokedAt || !current.has(t.family))
          continue;
        const row = byClient.get(t.clientId) ?? {
          clientId: t.clientId,
          name: clients.get(t.clientId)?.name ?? '',
          connectedAt: t.createdAt,
          lastUsedAt: null,
          scopes: ['pips.read'],
        };
        if (!t.rotatedAt && t.scope.split(' ').includes('pips.write'))
          row.scopes = ['pips.read', 'pips.write'];
        if (t.createdAt < row.connectedAt) row.connectedAt = t.createdAt;
        if (t.lastUsedAt && (!row.lastUsedAt || t.lastUsedAt > row.lastUsedAt))
          row.lastUsedAt = t.lastUsedAt;
        byClient.set(t.clientId, row);
      }
      return [...byClient.values()].sort(
        (a, b) => b.connectedAt.getTime() - a.connectedAt.getTime(),
      );
    },
    revokeApp: async (userId, clientId, now) => {
      for (const a of auths)
        if (a.userId === userId && a.clientId === clientId && !a.usedAt)
          a.usedAt = now;
      let n = 0;
      for (const t of tokens)
        if (t.userId === userId && t.clientId === clientId && !t.revokedAt) {
          t.revokedAt = now;
          n++;
        }
      return n;
    },
    findUserById: async (id) => users[id] as User | undefined,
  };

  return { deps, clock, clients, auths, tokens, users, insertToken };
}
