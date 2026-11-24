import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { env } from '~/configs/env.config';
import { db, type Database } from '~/db/drizzle';
import { runInBackground } from '~/lib/background';
import { JWT_ALG } from '~/lib/jwt';
import { sendNotificationToAll, type PushData } from '~/lib/push-manager';
import {
  CLAIM_MAX_TRIES,
  claimOpen,
  destinationProblem,
  nameProblem,
  ownerPush,
  randomName,
  tidyName,
  type ClaimLock,
  type NameProblem,
  type OwnerPush,
} from '~/lib/short-link';
import { forRoles } from '~/middlewares/role.middleware';
import {
  getPushSubscriptionsByUserIds,
  removeFailedPushSubscriptions,
} from '~/repositories/push.repo';
import {
  claimAccount,
  clearClaimLocks,
  countMemberLinks,
  createLink,
  deleteLink,
  findAccountsByLogin,
  getAccount,
  getClaimLocks,
  getLink,
  getMemberByNim,
  getPerson,
  giveLink,
  listAllLinks,
  listMemberLinks,
  nameHolder,
  NameTakenError,
  recordWrongClaim,
  renameLink,
  setDestination,
  unclaimedAccountLinks,
  type LinkRow,
} from '~/repositories/short-link.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  changeShortLinkDestinationRoute,
  checkShortLinkNameRoute,
  claimShortLinksRoute,
  createShortLinkRoute,
  deleteShortLinkRoute,
  getShortLinkRoute,
  giveShortLinkRoute,
  listAllShortLinksRoute,
  listShortLinksRoute,
  lookUpShortLinkClaimRoute,
  renameShortLinkRoute,
} from '~/routes/short-link.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What a claim's step 1 proves, for step 2: this member gave this account's password, a few minutes ago. */
const CLAIM_TOKEN_SECONDS = 10 * 60;
const CLAIM_PURPOSE = 'short-link-claim';

/**
 * A bcrypt hash of nothing anyone types, compared when no account matches, so a wrong username takes as long as a
 * wrong password. Cost 10, the old service's default.
 */
let dummyHash: Promise<string> | undefined;
const getDummyHash = async () =>
  await (dummyHash ??= bcrypt.hash(`no account ${Math.random()}`, 10));

export interface ShortLinkDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
  listMemberLinks: WithoutDb<typeof listMemberLinks>;
  countMemberLinks: WithoutDb<typeof countMemberLinks>;
  listAllLinks: WithoutDb<typeof listAllLinks>;
  getLink: WithoutDb<typeof getLink>;
  getPerson: WithoutDb<typeof getPerson>;
  getMemberByNim: WithoutDb<typeof getMemberByNim>;
  getAccount: WithoutDb<typeof getAccount>;
  unclaimedAccountLinks: WithoutDb<typeof unclaimedAccountLinks>;
  nameHolder: WithoutDb<typeof nameHolder>;
  createLink: WithoutDb<typeof createLink>;
  setDestination: WithoutDb<typeof setDestination>;
  renameLink: WithoutDb<typeof renameLink>;
  deleteLink: WithoutDb<typeof deleteLink>;
  giveLink: WithoutDb<typeof giveLink>;
  findAccountsByLogin: WithoutDb<typeof findAccountsByLogin>;
  claimAccount: WithoutDb<typeof claimAccount>;
  getClaimLocks: WithoutDb<typeof getClaimLocks>;
  recordWrongClaim: WithoutDb<typeof recordWrongClaim>;
  clearClaimLocks: WithoutDb<typeof clearClaimLocks>;
  /** Sends `push` to every device of `userId`; awaited by nothing (the answer doesn't wait for push services). */
  notify: (userId: string, push: PushData) => Promise<void>;
  /** Settings, read when a request comes. */
  settings: () => { shortHost: string; claimUntil: Date | undefined };
  now: () => Date;
  compare: (password: string, hash: string) => Promise<boolean>;
}

async function notifyDevices(
  database: Database,
  userId: string,
  push: PushData,
) {
  const subscriptions = await getPushSubscriptionsByUserIds(database, [userId]);
  if (subscriptions.length === 0) return;
  const results = await sendNotificationToAll(subscriptions, push);
  await removeFailedPushSubscriptions(database, results);
}

const databaseDeps: ShortLinkDeps = {
  getUserRoles: withDb(getUserRoles),
  listMemberLinks: withDb(listMemberLinks),
  countMemberLinks: withDb(countMemberLinks),
  listAllLinks: withDb(listAllLinks),
  getLink: withDb(getLink),
  getPerson: withDb(getPerson),
  getMemberByNim: withDb(getMemberByNim),
  getAccount: withDb(getAccount),
  unclaimedAccountLinks: withDb(unclaimedAccountLinks),
  nameHolder: withDb(nameHolder),
  createLink: withDb(createLink),
  setDestination: withDb(setDestination),
  renameLink: withDb(renameLink),
  deleteLink: withDb(deleteLink),
  giveLink: withDb(giveLink),
  findAccountsByLogin: withDb(findAccountsByLogin),
  claimAccount: withDb(claimAccount),
  getClaimLocks: withDb(getClaimLocks),
  recordWrongClaim: withDb(recordWrongClaim),
  clearClaimLocks: withDb(clearClaimLocks),
  notify: async (userId, push) => {
    await notifyDevices(db, userId, push);
  },
  settings: () => ({
    shortHost: env.SHORTLINK_HOST,
    claimUntil: env.SHORTLINK_CLAIM_UNTIL,
  }),
  now: () => new Date(),
  compare: async (password, hash) => await bcrypt.compare(password, hash),
};

const iso = (d: Date) => d.toISOString();

export function createShortLinkRouter(deps: ShortLinkDeps = databaseDeps) {
  const router = createAuthRouter();
  const isAdmin = async (userId: string) =>
    (await deps.getUserRoles(userId)).includes('admin');

  /** Tells a link's holder what an admin did to it, unless the admin is the holder or nobody holds it. */
  function tell(holderId: string | null, actorId: string, p: OwnerPush) {
    if (!holderId || holderId === actorId) return;
    runInBackground(
      'Short link push',
      deps.notify(holderId, ownerPush(p, deps.settings().shortHost)),
    );
  }

  /** The link as its page shows it, to this member; null when they may not see it (404). */
  async function view(link: LinkRow, userId: string, admin: boolean) {
    const holderId = link.formId ? link.formOwnerId : link.ownerId;
    const base = {
      id: link.id,
      name: link.name,
      olderNames: link.olderNames,
      destination: link.destination,
      form:
        link.formId && link.formTitle !== null
          ? { id: link.formId, title: link.formTitle }
          : null,
      clicks: link.clicks,
      createdAt: iso(link.createdAt),
      updatedAt: iso(link.updatedAt),
      owner: null,
      oldAccount: null,
      movedTo: null,
    };
    if (link.deletedAt) {
      if (link.ownerId !== userId && !admin) return null;
      return {
        ...base,
        state: 'deleted' as const,
        olderNames: [],
        destination: null,
        canEdit: false,
      };
    }
    if (link.formId && !link.formPublished && !admin && holderId !== userId)
      return null;
    if (holderId !== userId && !admin) {
      if (link.previousOwnerId !== userId) return null;
      const to = link.ownerId ? await deps.getPerson(link.ownerId) : null;
      return {
        ...base,
        state: 'moved' as const,
        olderNames: [],
        destination: null,
        clicks: 0,
        canEdit: false,
        movedTo: to?.fullName ?? null,
      };
    }
    const [owner, account] = admin
      ? await Promise.all([
          holderId ? deps.getPerson(holderId) : null,
          link.accountId ? deps.getAccount(link.accountId) : null,
        ])
      : [null, null];
    const others =
      account && !link.formId
        ? (await deps.unclaimedAccountLinks(account.id)).filter(
            (l) => l.id !== link.id,
          ).length
        : 0;
    return {
      ...base,
      state: 'own' as const,
      canEdit: !link.formId,
      owner,
      oldAccount: account
        ? { username: account.username, otherUnclaimed: others }
        : null,
    };
  }

  /** The link as it is now, just after this member changed or made it. */
  async function shownNow(id: string, userId: string, admin: boolean) {
    const link = await deps.getLink(id);
    const shown = link && (await view(link, userId, admin));
    if (!shown) throw new Error('A link just saved is not there');
    return shown;
  }

  /** The link if this member may change it: theirs or, for admin, anyone's; never a form's or a deleted one. */
  async function editable(id: string, userId: string) {
    const link = await deps.getLink(id);
    if (!link || link.deletedAt) return { ok: false, status: 404 } as const;
    const admin = await isAdmin(userId);
    const holderId = link.formId ? link.formOwnerId : link.ownerId;
    if (holderId !== userId && !admin)
      return { ok: false, status: 404 } as const;
    if (link.formId) return { ok: false, status: 409 } as const;
    return { ok: true, link, admin } as const;
  }

  type Refusal =
    | { problem: NameProblem | 'used'; heldAs?: undefined; heldBy?: undefined }
    | { problem: 'taken'; heldAs: string; heldBy: 'link' | 'form' };

  /** Why a new name can't be this link's (or a new link's), or null. */
  async function nameRefusal(
    name: string,
    linkId: string | null,
  ): Promise<Refusal | null> {
    const problem = nameProblem(name);
    if (problem) return { problem };
    const holder = await deps.nameHolder(name, { linkId });
    if (!holder) return null;
    return holder.held === 'used'
      ? { problem: 'used' }
      : { problem: 'taken', heldAs: holder.heldAs, heldBy: holder.heldBy };
  }

  router.openapi(listShortLinksRoute, async (c) => {
    const user = c.var.user;
    const q = c.req.valid('query');
    const { rows, total } = await deps.listMemberLinks(user.id, q);
    const { claimUntil } = deps.settings();
    return c.json(
      {
        links: rows.map((r) => ({
          id: r.id,
          name: r.name,
          destination: r.destination,
          form:
            r.formId && r.formTitle !== null
              ? { id: r.formId, title: r.formTitle }
              : null,
          clicks: r.clicks,
          createdAt: iso(r.createdAt),
          updatedAt: iso(r.updatedAt),
        })),
        total: total ?? (await deps.countMemberLinks(user.id)),
        claim: {
          open: claimOpen(claimUntil, deps.now()),
          until: claimUntil ? iso(claimUntil) : null,
        },
      },
      200,
    );
  });

  router.openapi(checkShortLinkNameRoute, async (c) => {
    const { name: typed, linkId } = c.req.valid('query');
    const name = tidyName(typed);
    const refusal = await nameRefusal(name, linkId ?? null);
    return c.json(
      {
        name,
        available: refusal === null,
        problem: refusal?.problem ?? null,
        heldAs: refusal?.heldAs ?? null,
        heldBy: refusal?.heldBy ?? null,
      },
      200,
    );
  });

  router.openapi(createShortLinkRoute, async (c) => {
    const user = c.var.user;
    const input = c.req.valid('json');
    const destination = input.destination.trim();
    const bad = destinationProblem(destination, deps.settings().shortHost);
    if (bad)
      return c.json(
        { error: 'Not a destination a link can have', destination: bad },
        400,
      );
    const typed = tidyName(input.name ?? '');
    if (typed) {
      const refusal = await nameRefusal(typed, null);
      if (
        refusal?.problem &&
        refusal.problem !== 'taken' &&
        refusal.problem !== 'used'
      )
        return c.json({ error: 'Not a name a link can have', ...refusal }, 400);
      if (refusal)
        return c.json({ error: 'The name is held', ...refusal }, 409);
    }
    let id: string | null = null;
    for (let attempt = 0; id === null; attempt++) {
      const name = typed || randomName();
      try {
        id = await deps.createLink({ destination, ownerId: user.id, name });
      } catch (err) {
        if (!(err instanceof NameTakenError)) throw err;
        if (typed) {
          const refusal = await nameRefusal(typed, null);
          return c.json(
            {
              error: 'The name is held',
              ...(refusal ?? { problem: 'taken' as const }),
            },
            409,
          );
        }
        if (attempt >= 5) throw err;
      }
    }
    return c.json(await shownNow(id, user.id, false), 201);
  });

  router.openapi(
    forRoles(listAllShortLinksRoute, ['admin'], deps.getUserRoles),
    async (c) => {
      const q = c.req.valid('query');
      let { rows, total, accounts } = await deps.listAllLinks(q);
      if (total === null)
        total =
          (await deps.listAllLinks({ ...q, offset: 0, limit: 1 })).total ?? 0;
      return c.json(
        {
          links: rows.map((r) => ({
            id: r.id,
            name: r.name,
            destination: r.destination,
            form:
              r.formId && r.formTitle !== null
                ? { id: r.formId, title: r.formTitle }
                : null,
            clicks: r.clicks,
            createdAt: iso(r.createdAt),
            updatedAt: iso(r.updatedAt),
            owner:
              r.ownerId && r.ownerName && r.ownerNim
                ? { id: r.ownerId, fullName: r.ownerName, nim: r.ownerNim }
                : null,
            oldAccount: r.ownerId ? null : r.accountUsername,
          })),
          total,
          accounts,
        },
        200,
      );
    },
  );

  router.openapi(lookUpShortLinkClaimRoute, async (c) => {
    const user = c.var.user;
    const { login, password } = c.req.valid('json');
    const { claimUntil } = deps.settings();
    const now = deps.now();
    if (!claimOpen(claimUntil, now))
      return c.json({ error: 'Claiming has ended' }, 410);
    const memberKey = `user:${user.id}`;
    const [account] = await deps.findAccountsByLogin(login);
    const accountKey = account ? `account:${account.id}` : null;
    const keys = accountKey ? [memberKey, accountKey] : [memberKey];
    const locks = new Map(
      (await deps.getClaimLocks(keys)).map((l) => [l.key, l as ClaimLock]),
    );
    /** The latest time any of the keys stays locked until, or undefined when none is locked now. */
    const lockedUntil = (m: Map<string, ClaimLock>, only = keys) => {
      let until: Date | undefined;
      for (const k of only) {
        const at = m.get(k)?.lockedUntil;
        if (at && at > now && (!until || at > until)) until = at;
      }
      return until;
    };
    const memberLocked = lockedUntil(locks, [memberKey]);
    if (memberLocked)
      return c.json({ error: 'Too many tries', until: iso(memberLocked) }, 429);
    // Always one bcrypt comparison, account or not, so the answer takes as long either way.
    const matches = await deps.compare(
      password,
      account?.passwordHash ?? (await getDummyHash()),
    );
    const locked = lockedUntil(locks);
    if (locked)
      return c.json({ error: 'Too many tries', until: iso(locked) }, 429);
    if (!account?.passwordHash || !matches) {
      const after = await deps.recordWrongClaim(keys, now);
      const nowLocked = lockedUntil(after);
      if (nowLocked)
        return c.json({ error: 'Too many tries', until: iso(nowLocked) }, 429);
      return c.json(
        {
          error: 'Username or password wrong',
          triesLeft: CLAIM_MAX_TRIES - (after.get(memberKey)?.tries ?? 0),
        },
        401,
      );
    }
    await deps.clearClaimLocks(keys);
    const answer = (
      state: 'found' | 'empty' | 'taken' | 'mine' | 'two_factor',
      extra: {
        links?: Array<{
          id: string;
          name: string;
          destination: string | null;
          clicks: number;
        }>;
        claimedAt?: Date | null;
        token?: string | null;
      } = {},
    ) =>
      c.json(
        {
          state,
          account: account.username,
          links: extra.links ?? [],
          claimedAt: extra.claimedAt ? iso(extra.claimedAt) : null,
          token: extra.token ?? null,
        },
        200,
      );
    if (account.claimedBy === user.id) return answer('mine');
    if (account.claimedBy)
      return answer('taken', { claimedAt: account.claimedAt });
    if (account.twoFactor) return answer('two_factor');
    const links = await deps.unclaimedAccountLinks(account.id);
    if (links.length === 0) return answer('empty');
    const token = await sign(
      {
        purpose: CLAIM_PURPOSE,
        sub: user.id,
        acct: account.id,
        exp: Math.floor(now.getTime() / 1000) + CLAIM_TOKEN_SECONDS,
      },
      env.JWT_SECRET,
      JWT_ALG,
    );
    return answer('found', { links, token });
  });

  router.openapi(claimShortLinksRoute, async (c) => {
    const user = c.var.user;
    const { token } = c.req.valid('json');
    const { claimUntil } = deps.settings();
    if (!claimOpen(claimUntil, deps.now()))
      return c.json({ error: 'Claiming has ended' }, 410);
    let accountId: string;
    try {
      const payload = await verify(token, env.JWT_SECRET, JWT_ALG);
      if (
        payload.purpose !== CLAIM_PURPOSE ||
        payload.sub !== user.id ||
        typeof payload.acct !== 'string'
      )
        throw new Error('Not a claim token for this member');
      accountId = payload.acct;
    } catch {
      return c.json({ error: 'Look the account up again' }, 400);
    }
    const account = await deps.getAccount(accountId);
    if (!account || account.twoFactor)
      return c.json({ error: 'Look the account up again' }, 400);
    if (account.claimedBy === user.id) return c.json({ moved: 0 }, 200);
    const moved = await deps.claimAccount({
      accountId,
      userId: user.id,
      via: 'password',
    });
    if (moved === null)
      return c.json({ error: 'Another member claimed it first' }, 409);
    return c.json({ moved }, 200);
  });

  router.openapi(getShortLinkRoute, async (c) => {
    const user = c.var.user;
    const link = await deps.getLink(c.req.valid('param').id);
    const shown = link && (await view(link, user.id, await isAdmin(user.id)));
    if (!shown) return c.json({ error: 'Link not found' }, 404);
    return c.json(shown, 200);
  });

  router.openapi(changeShortLinkDestinationRoute, async (c) => {
    const user = c.var.user;
    const { id } = c.req.valid('param');
    const found = await editable(id, user.id);
    if (!found.ok)
      return found.status === 404
        ? c.json({ error: 'Link not found' }, 404)
        : c.json({ error: 'A form’s link changes in the form' }, 409);
    const destination = c.req.valid('json').destination.trim();
    const bad = destinationProblem(destination, deps.settings().shortHost);
    if (bad)
      return c.json(
        { error: 'Not a destination a link can have', destination: bad },
        400,
      );
    if (destination !== found.link.destination) {
      await deps.setDestination(id, destination);
      tell(found.link.ownerId, user.id, {
        kind: 'destination',
        linkId: id,
        name: found.link.name,
      });
    }
    return c.json(await shownNow(id, user.id, found.admin), 200);
  });

  router.openapi(renameShortLinkRoute, async (c) => {
    const user = c.var.user;
    const { id } = c.req.valid('param');
    const found = await editable(id, user.id);
    if (!found.ok)
      return found.status === 404
        ? c.json({ error: 'Link not found' }, 404)
        : c.json({ error: 'A form’s link changes in the form' }, 409);
    const name = tidyName(c.req.valid('json').name);
    if (name !== found.link.name) {
      const refusal = await nameRefusal(name, id);
      if (
        refusal?.problem &&
        refusal.problem !== 'taken' &&
        refusal.problem !== 'used'
      )
        return c.json({ error: 'Not a name a link can have', ...refusal }, 400);
      if (refusal)
        return c.json({ error: 'The name is held', ...refusal }, 409);
      try {
        await deps.renameLink(id, name);
      } catch (err) {
        if (!(err instanceof NameTakenError)) throw err;
        const again = await nameRefusal(name, id);
        return c.json(
          {
            error: 'The name is held',
            ...(again ?? { problem: 'taken' as const }),
          },
          409,
        );
      }
      tell(found.link.ownerId, user.id, {
        kind: 'renamed',
        linkId: id,
        name,
        from: found.link.name,
      });
    }
    return c.json(await shownNow(id, user.id, found.admin), 200);
  });

  router.openapi(deleteShortLinkRoute, async (c) => {
    const user = c.var.user;
    const { id } = c.req.valid('param');
    const found = await editable(id, user.id);
    if (!found.ok)
      return found.status === 404
        ? c.json({ error: 'Link not found' }, 404)
        : c.json({ error: 'A form’s link goes with the form' }, 409);
    await deps.deleteLink(id);
    tell(found.link.ownerId, user.id, {
      kind: 'deleted',
      linkId: id,
      name: found.link.name,
    });
    return c.body(null, 204);
  });

  router.openapi(
    forRoles(giveShortLinkRoute, ['admin'], deps.getUserRoles),
    async (c) => {
      const user = c.var.user;
      const { id } = c.req.valid('param');
      const { nim, withAccount } = c.req.valid('json');
      const link = await deps.getLink(id);
      if (!link || link.deletedAt)
        return c.json({ error: 'Link not found' }, 404);
      if (link.formId)
        return c.json({ error: 'A form’s link belongs to the form' }, 409);
      const to = await deps.getMemberByNim(nim.trim());
      if (!to) return c.json({ error: 'No member has that NIM' }, 400);
      const moved = await deps.giveLink({
        linkId: id,
        toUserId: to.id,
        withAccount,
      });
      if (link.ownerId !== to.id)
        tell(link.ownerId, user.id, {
          kind: 'moved',
          linkId: id,
          name: link.name,
          to: to.fullName,
        });
      return c.json({ moved, link: await shownNow(id, user.id, true) }, 200);
    },
  );

  return router;
}

export const shortLinkRouter = createShortLinkRouter();
