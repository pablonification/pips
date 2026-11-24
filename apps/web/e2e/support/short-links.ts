/**
 * Tautan pendek in the pretend API: the reads (defaults, in handlers.ts) and the writes a test registers with
 * `api.on`. They follow `docs/short-links-api.md` and use the API's own name rule (`apps/api/src/lib/short-link.ts`),
 * so a name the field accepts here is one the server accepts.
 */
import type * as api from '../../src/api/generated/operations';
import { NOW, type Db } from '../fixtures/api';
import { PEOPLE, type PersonKey } from '../fixtures/prototype';
import { FORM_CLICKS, type StoredShortLink } from '../fixtures/short-links';
import {
  destinationProblem,
  nameProblem,
  tidyName,
} from '../../../api/src/lib/short-link';
import { reply, type Handler } from './mock';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any generated client method
type R<F extends (...args: any[]) => unknown> = Awaited<ReturnType<F>>;
type Summary = R<typeof api.listShortLinks>['links'][number];

const signedIn: (h: Handler) => Handler = (h) => (req) =>
  req.db.signedIn && req.db.me
    ? h(req)
    : reply.status(401, { message: 'Unauthorized' });
const admin: (h: Handler) => Handler = (h) =>
  signedIn((req) =>
    req.db.me!.roles.includes('admin')
      ? h(req)
      : reply.status(401, { error: 'Unauthorized' }),
  );
const isAdmin = (db: Db) => !!db.me?.roles.includes('admin');
const notFound = () => reply.status(404, { error: 'Not found' });

/** A member by NIM, as the API sends them. */
export function personByNim(db: Db, nim: string) {
  const m =
    db.members.find((u) => u.nim === nim) ??
    (db.me?.nim === nim ? db.me : undefined);
  return m ? { id: m.id, fullName: m.fullName, nim: m.nim } : null;
}
const nimOf = (key: PersonKey) => PEOPLE[key].nim;

/** Published forms' links, as the API lists them: the form's name, its maker, its clicks. */
function formLinks(db: Db) {
  return db.formStore
    .filter((f) => f.publishedAt && f.ownerId)
    .map((f) => {
      const owner = db.members.find((u) => u.id === f.ownerId);
      return {
        id: `form-${f.id}`,
        name: f.slug,
        olderNames: [] as string[],
        destination: null,
        form: { id: f.id, title: f.title },
        owner: owner?.nim ?? null,
        oldAccount: null,
        clicks: FORM_CLICKS[f.id] ?? 0,
        createdAt: f.publishedAt!,
        updatedAt: f.publishedAt!,
      };
    });
}

type AnyLink = StoredShortLink | ReturnType<typeof formLinks>[number];
const isForm = (l: AnyLink): l is ReturnType<typeof formLinks>[number] =>
  'form' in l && !!l.form;

const summary = (l: AnyLink): Summary => ({
  id: l.id,
  name: l.name,
  destination: l.destination,
  form: (isForm(l) ? l.form : null) as Summary['form'],
  clicks: l.clicks,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

function ordered(list: AnyLink[], order: string | null) {
  return [...list].sort((a, b) =>
    order === 'clicks'
      ? b.clicks - a.clicks
      : Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
const has = (hay: string | null | undefined, q: string) =>
  (hay ?? '').toLowerCase().includes(q.toLowerCase());

function page(query: URLSearchParams) {
  const offset = Number(query.get('offset') ?? 0);
  const limit = Number(query.get('limit') ?? 50);
  return <T>(list: T[]) => list.slice(offset, offset + limit);
}

/** Who holds a name (current or older, any link or form), compared without capitals, and as what. */
export function shortLinkHolder(db: Db, name: string, linkId?: string | null) {
  const f = name.toLowerCase();
  for (const l of [...db.shortLinks, ...formLinks(db)]) {
    const names = [l.name, ...l.olderNames];
    const hit = names.find((x) => x.toLowerCase() === f);
    if (!hit) continue;
    if (linkId && l.id === linkId) return null;
    return {
      problem: 'taken' as const,
      heldAs: hit,
      heldBy: isForm(l) ? ('form' as const) : ('link' as const),
    };
  }
  if (db.shortLinkGone.includes(f)) return { problem: 'used' as const };
  return null;
}

function linkView(db: Db, l: AnyLink) {
  const asAdmin = isAdmin(db);
  const old = !isForm(l) && l.oldAccount;
  return {
    state: 'own' as const,
    id: l.id,
    name: l.name,
    olderNames: l.olderNames,
    destination: l.destination,
    form: isForm(l) ? l.form : null,
    clicks: l.clicks,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    canEdit: !isForm(l),
    owner: l.owner ? personByNim(db, l.owner) : null,
    oldAccount:
      asAdmin && old
        ? {
            username: old,
            otherUnclaimed: db.shortLinks.filter(
              (x) => x.oldAccount === old && !x.owner && x.id !== l.id,
            ).length,
          }
        : null,
    movedTo: null,
  } as unknown as R<typeof api.getShortLink>;
}

function findLink(db: Db, id: string): AnyLink | undefined {
  return [...db.shortLinks, ...formLinks(db)].find((l) => l.id === id);
}
/** The holder (or admin) may read and change a link; anyone else gets 404, as the API answers. */
function mayHold(db: Db, l: AnyLink) {
  return isAdmin(db) || (!!l.owner && l.owner === db.me!.nim);
}

export const shortLinkReads: Record<string, Handler> = {
  // Registered in order and matched last first: `/:id` before the fixed names, so they win.
  'GET /api/short-links/:id': signedIn(({ db, params }) => {
    const landing = db.shortLinkLandings[params.id];
    if (landing)
      return {
        ...landing,
        id: params.id,
        olderNames: [],
        destination: null,
        form: null,
        clicks: 0,
        createdAt: NOW,
        updatedAt: NOW,
        canEdit: false,
        owner: null,
        oldAccount: null,
      } as unknown as R<typeof api.getShortLink>;
    const l = findLink(db, params.id);
    if (!l || !mayHold(db, l)) return notFound();
    return linkView(db, l);
  }),
  'GET /api/short-links': signedIn(({ db, query }) => {
    const q = query.get('search')?.trim() ?? '';
    const mine = [...db.shortLinks, ...formLinks(db)].filter(
      (l) => l.owner === db.me!.nim,
    );
    const found = mine.filter(
      (l) =>
        !q ||
        has(l.name, q) ||
        has(l.destination, q) ||
        (isForm(l) && has(l.form.title, q)),
    );
    const sorted = ordered(found, query.get('order'));
    return {
      links: page(query)(sorted).map(summary),
      total: sorted.length,
      claim: db.shortLinkClaim,
    } satisfies R<typeof api.listShortLinks>;
  }),
  'GET /api/short-links/name-check': signedIn(({ db, query }) => {
    const name = tidyName(query.get('name') ?? '');
    const refusal =
      (nameProblem(name) && { problem: nameProblem(name)! }) ||
      shortLinkHolder(db, name, query.get('linkId'));
    return {
      name,
      available: !refusal,
      problem: refusal ? refusal.problem : null,
      heldAs: (refusal && 'heldAs' in refusal && refusal.heldAs) || null,
      heldBy: (refusal && 'heldBy' in refusal && refusal.heldBy) || null,
    } satisfies R<typeof api.checkShortLinkName>;
  }),
  'GET /api/short-links/all': admin(({ db, query }) => {
    const q = query.get('search')?.trim() ?? '';
    const unclaimed = query.get('view') === 'unclaimed';
    const all = [...db.shortLinks, ...formLinks(db)].filter(
      (l) => !unclaimed || !l.owner,
    );
    const found = all.filter((l) => {
      if (!q) return true;
      const p = l.owner ? personByNim(db, l.owner) : null;
      return [
        l.name,
        l.destination,
        isForm(l) ? l.form.title : '',
        p?.fullName,
        p?.nim,
        isForm(l) ? '' : l.oldAccount,
      ].some((x) => has(x, q));
    });
    const sorted = ordered(found, query.get('order'));
    return {
      links: page(query)(sorted).map((l) => ({
        ...summary(l),
        owner: (l.owner ? personByNim(db, l.owner) : null) as never,
        oldAccount: isForm(l) ? null : l.owner ? null : l.oldAccount,
      })),
      total: sorted.length,
      accounts: new Set(
        db.shortLinks.filter((l) => !l.owner).map((l) => l.oldAccount),
      ).size,
    } satisfies R<typeof api.listAllShortLinks>;
  }),
};

/* ---------------- Writes ---------------- */

const problemReply = (r: {
  problem: string;
  heldAs?: string;
  heldBy?: string;
}) =>
  reply.status(r.problem === 'taken' || r.problem === 'used' ? 409 : 400, {
    error: 'The name can’t be used',
    ...r,
  });

/** POST /api/short-links: a random six-letter name when none is given. */
export const createShortLink: Handler = signedIn(({ db, body }) => {
  const b = body as { destination: string; name?: string };
  const dp = destinationProblem(b.destination, 's.hmif.dev');
  if (dp)
    return reply.status(400, { error: 'Not a destination', destination: dp });
  const name = b.name ? tidyName(b.name) : 'k7m2xq';
  const refusal =
    (nameProblem(name) && { problem: nameProblem(name)! }) ||
    shortLinkHolder(db, name);
  if (refusal) return problemReply(refusal);
  const link: StoredShortLink = {
    id: `l-new-${db.shortLinks.length}`,
    name,
    olderNames: [],
    destination: b.destination.trim(),
    owner: db.me!.nim,
    oldAccount: null,
    clicks: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  db.shortLinks.push(link);
  return reply.status(201, linkView(db, link));
});

const editable = (db: Db, id: string) => {
  const l = findLink(db, id);
  if (!l || !mayHold(db, l)) return { error: notFound() };
  if (isForm(l))
    return { error: reply.status(409, { error: 'A form’s link' }) };
  return { link: l as StoredShortLink };
};

/** PATCH /api/short-links/:id — where it goes. */
export const changeShortLinkDestination: Handler = signedIn(
  ({ db, params, body }) => {
    const found = editable(db, params.id);
    if (found.error) return found.error;
    const destination = (body as { destination: string }).destination;
    const dp = destinationProblem(destination, 's.hmif.dev');
    if (dp)
      return reply.status(400, { error: 'Not a destination', destination: dp });
    Object.assign(found.link, { destination, updatedAt: NOW });
    return linkView(db, found.link);
  },
);

/** PUT /api/short-links/:id/name — the old name stays, newest first. */
export const renameShortLink: Handler = signedIn(({ db, params, body }) => {
  const found = editable(db, params.id);
  if (found.error) return found.error;
  const l = found.link;
  const name = tidyName((body as { name: string }).name);
  const refusal =
    (nameProblem(name) && { problem: nameProblem(name)! }) ||
    shortLinkHolder(db, name, l.id);
  if (refusal) return problemReply(refusal);
  l.olderNames = [
    l.name,
    ...l.olderNames.filter((x) => x.toLowerCase() !== name.toLowerCase()),
  ];
  Object.assign(l, { name, updatedAt: NOW });
  return linkView(db, l);
});

/** DELETE /api/short-links/:id — its names are never given out again. */
export const deleteShortLink: Handler = signedIn(({ db, params }) => {
  const found = editable(db, params.id);
  if (found.error) return found.error;
  const l = found.link;
  db.shortLinks = db.shortLinks.filter((x) => x !== l);
  db.shortLinkGone.push(
    ...[l.name, ...l.olderNames].map((x) => x.toLowerCase()),
  );
  return reply.text('', 204);
});

/** POST /api/short-links/:id/give — to the member with that NIM, with the old account's other untaken links. */
export const giveShortLink: Handler = admin(({ db, params, body }) => {
  const b = body as { nim: string; withAccount?: boolean };
  const found = editable(db, params.id);
  if (found.error) return found.error;
  if (!personByNim(db, b.nim))
    return reply.status(400, { error: 'No member with that NIM' });
  const l = found.link;
  const moving = [
    l,
    ...(b.withAccount && l.oldAccount && !l.owner
      ? db.shortLinks.filter(
          (x) => x !== l && x.oldAccount === l.oldAccount && !x.owner,
        )
      : []),
  ];
  for (const x of moving) Object.assign(x, { owner: b.nim, oldAccount: null });
  return { moved: moving.length, link: linkView(db, l) };
});

/** The account a login means: its own name, or the alias (email) it is known by. */
function accountOf(db: Db, login: string) {
  const k = login.trim().toLowerCase();
  if (db.oldAccounts[k]) return k;
  return (
    Object.entries(db.oldAccounts).find(([, a]) => a.alias === k)?.[0] ?? null
  );
}

/** POST /api/short-links/claim/lookup — what claiming would do; 401 with the tries left, 429 after five. */
export const lookUpShortLinkClaim: Handler = signedIn(({ db, body }) => {
  const b = body as { login: string; password: string };
  const key = accountOf(db, b.login);
  const acct = key ? db.oldAccounts[key] : null;
  const locked = () =>
    reply.status(429, {
      error: 'Too many tries',
      until: new Date(Date.parse(NOW) + 15 * 60_000).toISOString(),
    });
  // Locked, even the right password waits.
  if (db.claimTries >= 5) return locked();
  if (!acct || acct.password !== b.password) {
    db.claimTries += 1;
    if (db.claimTries >= 5) return locked();
    return reply.status(401, {
      error: 'Wrong',
      triesLeft: 5 - db.claimTries,
    });
  }
  // A right password doesn't wipe the wrong ones before it; the lock clears them after 15 minutes.
  const me = db.me!.nim;
  const links = db.shortLinks.filter((l) => l.oldAccount === key && !l.owner);
  const base = { account: key!, links: [], claimedAt: null, token: null };
  if (acct.twoFactor) return { ...base, state: 'two_factor' };
  if (
    (acct.matched && nimOf(acct.matched) === me) ||
    (acct.claimedBy && nimOf(acct.claimedBy) === me)
  )
    return { ...base, state: 'mine' };
  if (acct.claimedBy)
    return { ...base, state: 'taken', claimedAt: acct.claimedAt ?? null };
  if (!links.length) return { ...base, state: 'empty' };
  return {
    ...base,
    state: 'found',
    links: links.map((l) => ({
      id: l.id,
      name: l.name,
      destination: l.destination,
      clicks: l.clicks,
    })),
    token: `claim:${key}`,
  } satisfies R<typeof api.lookUpShortLinkClaim>;
});

/** POST /api/short-links/claim — the looked-up account's links become the member's. */
export const claimShortLinks: Handler = signedIn(({ db, body }) => {
  const token = (body as { token: string }).token;
  const key = token.replace(/^claim:/, '');
  const acct = db.oldAccounts[key];
  if (!acct) return reply.status(400, { error: 'Look up again' });
  if (acct.claimedBy) return reply.status(409, { error: 'Claimed first' });
  const links = db.shortLinks.filter((l) => l.oldAccount === key && !l.owner);
  for (const l of links)
    Object.assign(l, { owner: db.me!.nim, oldAccount: null });
  return { moved: links.length };
});

/** Every write of Tautan pendek, for a journey that uses them all. */
export const shortLinkWrites = {
  'POST /api/short-links': createShortLink,
  'PATCH /api/short-links/:id': changeShortLinkDestination,
  'PUT /api/short-links/:id/name': renameShortLink,
  'DELETE /api/short-links/:id': deleteShortLink,
  'POST /api/short-links/:id/give': giveShortLink,
  'POST /api/short-links/claim/lookup': lookUpShortLinkClaim,
  'POST /api/short-links/claim': claimShortLinks,
} as const;
