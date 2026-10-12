import type { JSX } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import GoogleLogo from '~/assets/icons/login/google.svg';
import { Button } from '~/components/ui/button';
import useLogin from '../../hooks/auth/useLogin';
import { safeRedirect } from '~/lib/safe-redirect';
import LoginLayout from './-components/LoginLayout';

// `redirect`: where to go after signing in (a deep link that needed sign-in). Anything that isn't a path on this
// site is dropped, and sign-in then goes to Beranda.
const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/login/')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginRoute,
});

// The Google sign-in provider (and its script) belongs to this route only (SPEC "Third parties").
function LoginRoute(): JSX.Element {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <LoginPage />
    </GoogleOAuthProvider>
  );
}

function LoginPage(): JSX.Element {
  const { redirect } = Route.useSearch();
  const { login, devLogin } = useLogin(safeRedirect(redirect) ?? '/');

  return (
    <LoginLayout>
      <h1 className="text-white italic lg:text-black">
        <span className="text-heading-lg not-italic">
          Hello, <span className="font-bold italic">Pips!</span>
        </span>
        <br />
        Log in with your std email to get you in
      </h1>

      <Button
        onClick={() => login()}
        className="flex w-full items-center gap-3 bg-white font-medium text-black lg:hidden"
        size="icon-md"
      >
        <img src={GoogleLogo} className="size-5" alt="" />
        Log in with Google
      </Button>
      <Button
        onClick={() => login()}
        variant="outlined"
        className="hidden w-full items-center gap-3 font-medium lg:flex"
        size="icon-md"
      >
        <img src={GoogleLogo} className="size-5" alt="" />
        Log in with Google
      </Button>
      {__TEST_LOGIN_ENABLED__ && (
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            devLogin.mutate({
              email: String(data.get('email')),
              password: String(data.get('password')),
            });
          }}
        >
          <p className="text-white lg:text-black">Test account login</p>
          <input
            className="rounded border p-3 text-black"
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="username"
            required
          />
          <input
            className="rounded border p-3 text-black"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
          {devLogin.error && (
            <p role="alert" className="text-red-500">
              {devLogin.error.message}
            </p>
          )}
          <Button type="submit" disabled={devLogin.isPending}>
            {devLogin.isPending
              ? 'Logging in…'
              : 'Log in with test credentials'}
          </Button>
        </form>
      )}
    </LoginLayout>
  );
}
