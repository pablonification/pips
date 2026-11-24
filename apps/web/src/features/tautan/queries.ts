/*
 * Tautan pendek's data. Every key sits under `['short-links', …]`, so one change refreshes the member's list, a link's
 * page and Kelola's list together. Nothing here is kept on the device.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import type {
  AdminShortLinkSummary,
  ShortLink,
  ShortLinkForm,
  ShortLinkPerson,
  ShortLinkSummary,
} from '~/api/generated';
import { PAGE_SIZE } from './rules';

/*
 * The generated types lose `null` on fields that point at another schema; the API sends null for a link that isn't a
 * form's, and for a link nobody holds.
 */
export type Summary = Omit<ShortLinkSummary, 'form'> & {
  form: ShortLinkForm | null;
};
export type AdminSummary = Omit<AdminShortLinkSummary, 'form' | 'owner'> & {
  form: ShortLinkForm | null;
  owner: ShortLinkPerson | null;
};
export type Link = Omit<ShortLink, 'form' | 'owner'> & {
  form: ShortLinkForm | null;
  owner: ShortLinkPerson | null;
};

export type Order = 'new' | 'clicks';
export type AdminView = 'all' | 'unclaimed';

const ROOT = 'short-links';
export const shortLinkKeys = {
  all: [ROOT] as const,
  mine: (search: string, order: Order) =>
    [ROOT, 'mine', { search, order }] as const,
  link: (id: string) => [ROOT, 'link', id] as const,
  admin: (search: string, view: AdminView) =>
    [ROOT, 'admin', { search, view }] as const,
};

/** The member's links, 50 at a time; `claim` says whether old accounts can still be claimed, and until when. */
export const myLinksQuery = (search = '', order: Order = 'new') =>
  infiniteQueryOptions({
    queryKey: shortLinkKeys.mine(search, order),
    queryFn: ({ pageParam }) =>
      api.listShortLinks({
        search: search || undefined,
        order,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.links.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

/** Every link with its holder or old account, for admin. */
export const adminLinksQuery = (search = '', view: AdminView = 'all') =>
  infiniteQueryOptions({
    queryKey: shortLinkKeys.admin(search, view),
    queryFn: ({ pageParam }) =>
      api.listAllShortLinks({
        search: search || undefined,
        view,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.links.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

export const linkQuery = (id: string) =>
  queryOptions({
    queryKey: shortLinkKeys.link(id),
    queryFn: () => api.getShortLink({ id }) as Promise<Link>,
    retry: (n, e) =>
      !(e instanceof Error && 'status' in e && e.status === 404) && n < 2,
  });

export const createLink = (destination: string, name: string) =>
  api.createShortLink({
    requestBody: { destination, ...(name ? { name } : {}) },
  }) as Promise<Link>;

export const checkName = (name: string, linkId?: string) =>
  api.checkShortLinkName({ name, linkId });

export const changeDestination = (id: string, destination: string) =>
  api.changeShortLinkDestination({
    id,
    requestBody: { destination },
  }) as Promise<Link>;

export const renameLink = (id: string, name: string) =>
  api.renameShortLink({ id, requestBody: { name } }) as Promise<Link>;

export const deleteLink = (id: string) => api.deleteShortLink({ id });

export const giveLink = (id: string, nim: string, withAccount: boolean) =>
  api.giveShortLink({ id, requestBody: { nim, withAccount } });

export const lookUpClaim = (login: string, password: string) =>
  api.lookUpShortLinkClaim({ requestBody: { login, password } });

export const takeClaim = (token: string) =>
  api.claimShortLinks({ requestBody: { token } });

export const searchMembers = (search: string) => api.getUser({ search });

/** A link changed: keep its page as the server answered, and read every list again. */
export function keepLink(client: QueryClient, link: Link) {
  client.setQueryData(shortLinkKeys.link(link.id), link);
  void client.invalidateQueries({
    queryKey: shortLinkKeys.all,
    predicate: (q) => q.queryKey[1] !== 'link',
  });
}

/** Something moved links between members: read everything again. */
export const refreshAll = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: shortLinkKeys.all });

/*
 * The links just made or claimed: the list washes them gold once, the first time it shows them. A module value, not
 * a query, so it never reaches the device's storage and goes with the page.
 */
let fresh = new Set<string>();
export const markFresh = (ids: readonly string[]) => {
  fresh = new Set(ids);
};
export function takeFresh(): Set<string> {
  const out = fresh;
  fresh = new Set();
  return out;
}
