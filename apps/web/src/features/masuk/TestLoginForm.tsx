import type { FormEvent } from 'react';
import { Button, Field, Input, SectionHead } from '~/components/garis';
import { masuk } from '~/copy/masuk';

const copy = masuk.uji;

/** The test login's failure, in words: wrong credentials, or no test account on this server. */
export function devLoginMessage(error: unknown): string | null {
  if (!error) return null;
  const status =
    typeof error === 'object' && 'status' in error
      ? Number((error as { status: unknown }).status)
      : 0;
  return status === 401 ? copy.salah : copy.tidakTersedia;
}

/**
 * Staging's test login (`__TEST_LOGIN_ENABLED__`, never in production builds): Garis fields, Indonesian labels and
 * errors. Rendered by the sign-in screen only when the flag is on.
 */
export function TestLoginForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (credentials: { email: string; password: string }) => void;
  pending: boolean;
  error: unknown;
}) {
  const message = devLoginMessage(error);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        onSubmit({
          email: String(data.get('email')),
          password: String(data.get('password')),
        });
      }}
    >
      <SectionHead title={copy.judul} />
      <Field label={copy.email}>
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label={copy.sandi} error={message ?? undefined}>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </Field>
      {message ? (
        <p role="alert" className="sr-only">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="paper"
        aria-disabled={pending || undefined}
      >
        {pending ? masuk.memproses : copy.tombol}
      </Button>
    </form>
  );
}
