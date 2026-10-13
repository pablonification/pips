import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api, queryClient } from '~/api/client';
import { User } from '~/api/generated';
import { currentCoursesQuery } from '~/api/queries';
import {
  afterSignIn,
  readFirstRunFlag,
  type FirstRunSignals,
} from '~/features/masuk/first-run';
import {
  popupProblem,
  signInProblem,
  type SignInProblem,
} from '~/features/masuk/sign-in';
import { readPushFacts, registerExistingPush } from '~/lib/push';
import { pushStatus } from '~/lib/push-state';
import { forgetMemberOnDevice, invalidateSession } from '~/lib/session';

/** First run's signals right after a sign-in, given up after 3 s (Beranda then). */
async function firstRunSignals(): Promise<FirstRunSignals | null> {
  const read = Promise.all([
    queryClient.fetchQuery(currentCoursesQuery()),
    readPushFacts().then(pushStatus),
  ]).then(([courses, push]) => ({ courseCount: courses.length, push }));
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 3000));
  return Promise.race([read.catch(() => null), timeout]);
}

/**
 * Sign-in with Google (and, on staging, test login). Afterwards it goes to `redirectTo` (a path already checked by
 * `safeRedirect`), else first run while a step is open on a device that hasn't finished or skipped it, else
 * Beranda. Failures come back as `problem` for the screen to say; nothing uses alert().
 */
export default function useLogin(redirectTo: string | null = null) {
  const navigate = useNavigate();
  // Google's script (accounts.google.com) may not load: blocked, offline, or still loading. Pressing the button then
  // says so instead of doing nothing.
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);

  // A new session starts clean: nothing cached for whoever used this device before.
  const start = async (user: User) => {
    void forgetMemberOnDevice();
    invalidateSession(user);
    // A device that already has notifications on is linked to the new session again, without asking anything.
    void registerExistingPush();
    const href = afterSignIn({
      redirect: redirectTo,
      flag: readFirstRunFlag(localStorage),
      signals: redirectTo ? null : await firstRunSignals(),
    });
    await navigate({ href, replace: true });
  };

  const loginCallbackMutation = useMutation({
    mutationFn: api.auth.loginAccessToken.bind(api.auth),
    onMutate() {
      setProblem(null);
    },
    onSuccess: start,
    onError(error) {
      setProblem(signInProblem(error));
    },
  });

  const send = (accessToken: string) => {
    setLastToken(accessToken);
    loginCallbackMutation.mutate({ requestBody: { accessToken } });
  };

  const login = useGoogleLogin({
    onSuccess(tokenResponse) {
      send(tokenResponse.access_token);
    },
    onError() {
      setProblem('gagal');
    },
    onNonOAuthError(err) {
      setProblem(popupProblem(err.type));
    },
  });

  const devLogin = useMutation<User, Error, DevCredentials>({
    // Production builds set __TEST_LOGIN_ENABLED__ to false, so the request below is compiled out of them.
    mutationFn: __TEST_LOGIN_ENABLED__ ? requestDevLogin : testLoginUnavailable,
    onSuccess: start,
  });

  const openGoogle = () => {
    if (!scriptLoadedSuccessfully) {
      setProblem('gagal');
      return;
    }
    setProblem(null);
    login();
  };

  return {
    login: openGoogle,
    /**
     * Coba lagi after a server or network error: the same Google token again (it lasts an hour). Without a token,
     * Google's popup again; if Google's script never loaded, the page loads again to fetch it.
     */
    retry: () => {
      if (lastToken) send(lastToken);
      else if (scriptLoadedSuccessfully) openGoogle();
      else window.location.reload();
    },
    /** Waiting for the API, or for the destination's first-run check. */
    pending: loginCallbackMutation.isPending || loginCallbackMutation.isSuccess,
    problem,
    devLogin,
  };
}

interface DevCredentials {
  email: string;
  password: string;
}

/** The test login's failure: 401 for wrong credentials, anything else for an unavailable account. */
export class DevLoginError extends Error {
  constructor(readonly status: number) {
    super(`test login failed (${status})`);
  }
}

async function requestDevLogin(credentials: DevCredentials): Promise<User> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || ''}/api/auth/login/dev`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    },
  );
  if (!response.ok) throw new DevLoginError(response.status);
  return response.json();
}

function testLoginUnavailable(): Promise<User> {
  return Promise.reject(new DevLoginError(0));
}
