import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from './configs/env.config';

Sentry.init({
  dsn: env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  // Tracing: a share of requests (SENTRY_TRACES_SAMPLE_RATE, 0.1 unless set); every request cost CPU in a burst.
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
});
