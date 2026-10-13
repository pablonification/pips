import { z } from 'zod';
import { api, queryClient } from '~/api/client';
import { clearPersistedQueries } from '~/api/persister';
import { User, UserWithRoles } from '~/api/generated';
import { forgetShell } from '~/components/shell/shell-state';
import { forgetMember } from './forget-member';
import { deleteAllDrafts } from './form/draft-store';
import { isSignedOutError } from './session-policy';

export { sessionRetry, sessionRetryDelay } from './session-policy';

/** Signed out: nothing of the member stays on this device, in memory, in IndexedDB, localStorage or the tab. */
/*
 * A sign-out the member chose (Keluar) goes to plain sign-in; a session the server ended comes back to the page
 * afterwards. Without this, the next person to sign in on the device would land on the previous member's page.
 */
let chosenSignOut = false;
export function markChosenSignOut() {
  chosenSignOut = true;
}
/** True once after `markChosenSignOut()`. */
export function takeChosenSignOut() {
  const chosen = chosenSignOut;
  chosenSignOut = false;
  return chosen;
}

export function forgetMemberOnDevice() {
  return forgetMember({
    queryClient,
    removePersisted: clearPersistedQueries,
    storage: localStorage,
    forgetShell,
    removeFormDrafts: deleteAllDrafts,
  });
}

export function invalidateSession(user?: User | null) {
  if (user === undefined) {
    localStorage.removeItem('user');
    queryClient.invalidateQueries({ queryKey: ['me'] });
  } else if (user === null) {
    localStorage.setItem('user', 'null');
    queryClient.setQueryData(['me'], null);
  } else {
    localStorage.setItem('user', JSON.stringify(user));
    queryClient.setQueryData(['me'], user);
  }
}

const userSchema = z
  .object({
    id: z.string(),
    nim: z.string(),
    email: z.string(),
    fullName: z.string(),
    major: z.union([z.literal('IF'), z.literal('STI')]),
    region: z.union([z.literal('Ganesha'), z.literal('Jatinangor')]),
    angkatan: z.number(),
    gender: z.union([z.literal('F'), z.literal('M')]),
    membershipStatus: z.string(),
    picture: z.string(),
    roles: z.array(z.string()),
  })
  .nullable();

export function loadUserCache() {
  const queryClientUser = queryClient.getQueryData<UserWithRoles | null>([
    'me',
  ]);
  if (queryClientUser !== undefined) {
    return queryClientUser;
  }
  try {
    const user = localStorage.getItem('user');
    if (!user) return undefined;
    return userSchema.parse(JSON.parse(user)) as UserWithRoles;
  } catch (error) {
    return undefined;
  }
}

export function tryToLoadUserLocalStorage() {
  const user = localStorage.getItem('user');
  if (!user) {
    throw new Error('User not found');
  }
  return userSchema.parse(JSON.parse(user)) as UserWithRoles;
}

export function saveUserCache(user: User | null) {
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * The session check (`GET /api/me`): the user, or null when the server says the session is gone (401).
 * Anything else (offline, a dropped request, a 5xx) throws, so the cached user stays and the check retries.
 */
export async function fetchSession(): Promise<UserWithRoles | null> {
  try {
    return await api.auth.getMe();
  } catch (error) {
    if (isSignedOutError(error)) return null;
    throw error;
  }
}
