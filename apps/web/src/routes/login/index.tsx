import type { JSX } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginScreen } from '~/features/masuk/LoginScreen';
import { object, string } from '~/lib/params';
import { safeRedirect } from '~/lib/safe-redirect';
import { loadUserCache } from '~/lib/session';

// `redirect`: where to go after signing in (a deep link that needed sign-in). Anything that isn't a path on this
// site is dropped, and sign-in then goes to first run or Beranda.
const loginSearchSchema = object({ redirect: string });

export const Route = createFileRoute('/login/')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  // Already signed in: go where sign-in would have gone.
  beforeLoad: ({ search }) => {
    if (loadUserCache())
      throw redirect({
        href: safeRedirect(search.redirect) ?? '/',
        replace: true,
      });
  },
  component: LoginRoute,
});

// The Google sign-in provider (and its script) belongs to this route only (SPEC "Third parties").
function LoginRoute(): JSX.Element {
  const { redirect } = Route.useSearch();
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <LoginScreen redirectTo={safeRedirect(redirect) ?? null} />
    </GoogleOAuthProvider>
  );
}
