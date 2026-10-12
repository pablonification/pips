/**
 * Error monitoring. Without a DSN (VITE_SENTRY_DSN) it does nothing and loads nothing. With one, Sentry loads
 * after the first render in its own chunk, so it never counts towards a route's first-render JS (SPEC
 * "Performance architecture and budgets", "Third parties"). The settings are the ones the app had before.
 */
type Sentry = typeof import('@sentry/react');

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let sentry: Promise<Sentry> | null = null;

export function startMonitoring() {
  if (!dsn || sentry) return;
  sentry = import('@sentry/react').then((module) => {
    const { init, browserProfilingIntegration } = module;
    init({
      dsn,
      integrations: [browserProfilingIntegration()],
      tracesSampleRate: 1.0,
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/api\.app\.hmif\.dev\//,
        /^https:\/\/api\.app-staging\.hmif\.dev\//,
      ],
      profilesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 0.5,
    });
    return module;
  });
}

/** Sends an error to Sentry once it has loaded; a no-op without a DSN. */
export function reportError(error: unknown) {
  void sentry?.then(({ captureException }) => captureException(error));
}
