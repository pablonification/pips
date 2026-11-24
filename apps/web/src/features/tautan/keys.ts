/*
 * Tautan pendek's query keys, apart from its code: global search reads whether claiming is open from the list's
 * cache, and this file is all it loads for that (the rest of Tautan pendek is one chunk of its own, vite.config.ts).
 */
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
