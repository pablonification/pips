import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { common } from '~/copy/common';
import { reportError } from '~/instrument';
import { Button } from './ui/button';

/*
 * Safety nets (SPEC "Session, persistence and resilience"): one boundary per route, and one for the whole app.
 * Deliberately plain: P0-A's state components and P0-C's shell give them their final look. Plain links and a
 * full reload on purpose, because the router itself may be what failed.
 */

/** The whole app failed: Muat ulang and Ke Beranda. Used by the root route and around the router. */
export function RootErrorFallback({ error }: { error?: unknown }) {
  useEffect(() => {
    if (error) reportError(error);
  }, [error]);
  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-xl font-bold">{common.errors.halaman}</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => window.location.reload()}>
          {common.actions.muatUlang}
        </Button>
        <Button asChild variant="outlined">
          <a href="/">{common.actions.keBeranda}</a>
        </Button>
      </div>
    </main>
  );
}

/** One route failed: Coba lagi (reloads that route's data and code) and Ke Beranda. The shell stays usable. */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <section
      role="alert"
      className="flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h2 className="text-lg font-bold">{common.errors.bagian}</h2>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          {common.actions.cobaLagi}
        </Button>
        <Button asChild variant="outlined">
          <a href="/">{common.actions.keBeranda}</a>
        </Button>
      </div>
    </section>
  );
}
