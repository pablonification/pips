/*
 * What Kelola › Form's route loaders need: the query keys and options for the list and one form, and whether the
 * cached member may load them. Kept apart from queries.ts so the loaders, which every page's code carries, stay small.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { api } from '~/api/client';
import { FORM_QUERY_KEY, ME_QUERY_KEY } from '~/api/constants';
import type { UserWithRoles } from '~/api/generated';
import { kelolaAccess } from '../kelola/access';

export const MANAGE = [FORM_QUERY_KEY, 'manage'] as const;

export const manageKeys = {
  all: MANAGE,
  list: (scope: 'mine' | 'all') => [...MANAGE, 'list', scope] as const,
  form: (id: string) => [...MANAGE, id] as const,
  access: (id: string) => [...MANAGE, id, 'access'] as const,
  summary: (id: string) => [...MANAGE, id, 'summary'] as const,
  answers: (id: string, page: number) =>
    [...MANAGE, id, 'answers', page] as const,
};

/** Buatanku and Dibagikan ke aku (`mine`), or every form (`all`, admin). Newest change first. */
export const managedFormsQuery = (scope: 'mine' | 'all') =>
  queryOptions({
    queryKey: manageKeys.list(scope),
    queryFn: async () => (await api.form.listManagedForms({ scope })).forms,
  });

/** One form as the builder sees it, with what the caller may do (`access`). */
export const manageFormQuery = (formId: string) =>
  queryOptions({
    queryKey: manageKeys.form(formId),
    queryFn: () => api.form.getManagedForm({ formId }),
  });

/** For loaders: whether the cached member may open Kelola › Form, so nothing is asked before the gate. */
export function mayLoadForms(client: QueryClient): boolean {
  const me = client.getQueryData<UserWithRoles | null>([ME_QUERY_KEY]);
  return !!me && kelolaAccess(me, 'form').allowed;
}

/** The builder's own code, fetched while the form's data loads (the route's loader starts both). */
export const loadBuilder = () => import('./Builder');
