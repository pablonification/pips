import { queryOptions } from '@tanstack/react-query';
import { api } from '~/api/client';

/** An app's sign-in waiting for the member, by the id in the consent page's address. */
export const consentRequestQuery = (requestId: string) =>
  queryOptions({
    queryKey: ['oauth-request', requestId],
    queryFn: () => api.oauth.getOAuthRequest({ requestId }),
    // A request is answered once; a refetch after Izinkan would only find it gone.
    staleTime: Infinity,
    retry: false,
  });

export const CONNECTED_APPS_QUERY_KEY = 'oauth-apps';

/** Profil › Aplikasi terhubung. */
export const connectedAppsQuery = () =>
  queryOptions({
    queryKey: [CONNECTED_APPS_QUERY_KEY],
    queryFn: () => api.oauth.listConnectedApps(),
    select: (d) => d.apps,
  });
