import { queryOptions } from '@tanstack/react-query';
import { api } from '~/api/client';
import { ANGKATAN_QUERY_KEY } from '~/api/constants';

/* Profil's own reads; the shared ones (courses, academic profile, credits) are in ~/api/queries. */

/** Informasi akun's Grup: `[{ role, group }]`. */
export const groupsQuery = () =>
  queryOptions({
    queryKey: ['auth-groups'],
    queryFn: () => api.auth.getUserGroups(),
    staleTime: Infinity,
  });

/** The angkatan names, for the member card ("IF’25 · PIXEL"). Same key as today's `useAngkatanList`. */
export const angkatanQuery = () =>
  queryOptions({
    queryKey: [ANGKATAN_QUERY_KEY],
    queryFn: () => api.category.getListAngkatan(),
    staleTime: Infinity,
  });
