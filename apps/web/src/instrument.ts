/**
 * Error monitoring. Without a DSN (VITE_SENTRY_DSN) it does nothing and loads nothing. With one, Sentry loads
 * after the first render in its own chunk, so it never counts towards a route's first-render JS (SPEC
 * "Performance architecture and budgets", "Third parties"). Errors and traces only.
 */
import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react';

type Sentry = typeof import('@sentry/react');

const dsn = import.meta.env?.VITE_SENTRY_DSN as string | undefined;
let sentry: Promise<Sentry> | null = null;

/** The id in a Curhat room's page or its API path. */
const CURHAT_ROOM =
  /(\/(?:layanan|kelola)\/curhat\/|\/api\/curhat\/chatroom\/)[^/?#]+/g;

/**
 * An address as a report may carry it: no query or fragment (a search typed in NIM Finder or global search, the
 * chat connection's id) and no Curhat room id.
 */
function scrubUrl(url: string) {
  return url.replace(/[?#][\s\S]*$/, '').replace(CURHAT_ROOM, '$1:id');
}

function scrubBreadcrumb(crumb: Breadcrumb) {
  const data = crumb.data;
  if (data)
    for (const key of ['url', 'from', 'to'])
      if (typeof data[key] === 'string') data[key] = scrubUrl(data[key]);
  return crumb;
}

function scrubEvent(event: ErrorEvent) {
  const request = event.request;
  if (request) {
    if (request.url) request.url = scrubUrl(request.url);
    delete request.query_string;
    const referer = request.headers?.Referer;
    if (request.headers && referer) request.headers.Referer = scrubUrl(referer);
  }
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  return event;
}

export function sentryOptions(dsn: string): BrowserOptions {
  return {
    dsn,
    tracesSampleRate: 1.0,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/api\.app\.hmif\.dev\//,
      /^https:\/\/api\.app-staging\.hmif\.dev\//,
    ],
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  };
}

export function startMonitoring() {
  if (!dsn || sentry) return;
  sentry = import('@sentry/react').then((module) => {
    module.init(sentryOptions(dsn));
    return module;
  });
}

/** Sends an error to Sentry once it has loaded; a no-op without a DSN. */
export function reportError(error: unknown) {
  void sentry?.then(({ captureException }) => captureException(error));
}
