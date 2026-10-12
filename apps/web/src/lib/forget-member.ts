import type { QueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '~/api/constants';

/** localStorage keys that hold a member's data. `user` stays, as "null": the signed-out marker. */
export const MEMBER_STORAGE_KEYS = ['userAcademic'] as const;

/**
 * Nothing of the signed-in member stays on the device: at sign-out, on a 401 from the session check, and before
 * someone signs in. In this order, so nothing is written back:
 * 1. the persisted cache is removed, with any write still waiting;
 * 2. `me` becomes null, so the persister writes nothing more (it keeps only a signed-in member's cache);
 * 3. every other query and mutation leaves memory, and the member's localStorage keys go.
 */
export function forgetMember({
  queryClient,
  removePersisted,
  storage,
}: {
  queryClient: QueryClient;
  removePersisted: () => PromiseLike<void> | void;
  storage: Pick<Storage, 'removeItem' | 'setItem'>;
}): Promise<void> {
  const removed = removePersisted();
  queryClient.setQueryData([ME_QUERY_KEY], null);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY,
  });
  queryClient.getMutationCache().clear();
  storage.setItem('user', 'null');
  for (const key of MEMBER_STORAGE_KEYS) storage.removeItem(key);
  return Promise.resolve(removed);
}
