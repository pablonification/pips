import type { MiddlewareHandler } from 'hono';
import { createClickCounter, type ClickCounter } from '~/lib/click-counter';
import {
  isShortHost,
  nameCandidates,
  pickRedirect,
  redirectAnswer,
  type RedirectRow,
} from '~/lib/short-link';
import { logger } from '~/logger';

export interface ShortLinkRedirectDeps {
  /** One lookup: the rows whose name is a candidate, exactly or without capitals. */
  findRows: (candidates: readonly string[]) => Promise<RedirectRow[]>;
  clicks: Pick<ClickCounter, 'add'>;
}

/** Everything after the host's first slash, exactly as the request sent it: the old service matched that raw. */
function rawTarget(url: string): string {
  const afterScheme = url.indexOf('//');
  const slash = url.indexOf('/', afterScheme === -1 ? 0 : afterScheme + 2);
  return slash === -1 ? '' : url.slice(slash + 1);
}

/**
 * The short-link host (s.hmif.dev): every request to it is a redirect, and nothing else in the API answers there.
 * A link goes to its destination, a form's link to the form in PIPS!, `/` and the old dashboard to the member's
 * links, anything else to the not-found page. Never cached, so a changed destination applies at once.
 */
export function shortLinkRedirect(
  settings: () => { shortHost: string; webAppUrl: string },
  deps: ShortLinkRedirectDeps,
): MiddlewareHandler {
  return async (c, next) => {
    const { shortHost, webAppUrl } = settings();
    if (!isShortHost(c.req.header('host'), shortHost)) {
      await next();
      return;
    }
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      c.header('Allow', 'GET, HEAD');
      return c.text('Method not allowed', 405);
    }
    const target = rawTarget(c.req.url);
    const candidates = nameCandidates(target);
    let row: RedirectRow | null = null;
    try {
      row = pickRedirect(await deps.findRows(candidates), candidates);
    } catch (error) {
      logger.error({ type: 'short-link', message: String(error) });
      return c.text('Coba lagi sebentar lagi.', 503);
    }
    const answer = redirectAnswer(target, row, webAppUrl);
    if (answer.kind === 'link' && c.req.method === 'GET')
      deps.clicks.add(answer.linkId);
    return c.redirect(answer.location, 302);
  };
}

/** The app's own counter, written to the database (`index.ts` flushes it at shutdown). */
let counter: ClickCounter | undefined;
export function databaseClickCounter(
  write: (counts: Map<string, number>) => Promise<void>,
) {
  return (counter ??= createClickCounter({ write }));
}
export const flushClicks = async () => await counter?.flush();
