import og from 'open-graph-scraper';
import { STATUS_CODES } from 'node:http';
import {
  fetchPage,
  FetchPageError,
  UnsafeAddressError,
  type FetchPageOptions,
} from '~/lib/safe-fetch';
import { getOpenGraph } from '~/routes/open-graph.route';
import { OpenGraphErrorSchema, OgObjectSchema } from '~/types/open-graph.types';
import { createAuthRouter } from './router-factory';

/** The page's text in its own encoding (the header's charset, else a `<meta charset>`, else UTF-8). */
function decode(body: Buffer, contentType: string) {
  const head = body.subarray(0, 4096).toString('latin1');
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

/**
 * Link previews for members' posts, signed in only. The page is fetched here under `fetchPage`'s limits (public
 * addresses only, redirects checked, 5 s, 1 MiB), and open-graph-scraper only reads the HTML: it never fetches.
 */
export function createOpenGraphRouter(fetchOptions: FetchPageOptions = {}) {
  const router = createAuthRouter();

  router.openapi(getOpenGraph, async (c) => {
    const { url } = c.req.valid('query');
    // Per member: a preview is good for a day.
    c.header('Cache-Control', `private, max-age=${60 * 60 * 24}`);
    const fail = (error: string) =>
      c.json(
        OpenGraphErrorSchema.parse({ error, errorDetails: {}, success: false }),
        400,
      );

    let html: string;
    try {
      const page = await fetchPage(url, fetchOptions);
      if (page.status >= 400) {
        return fail(
          `${page.status} ${STATUS_CODES[page.status] ?? 'Error'}`.trim(),
        );
      }
      if (
        page.contentType &&
        !page.contentType.toLowerCase().includes('text/')
      ) {
        return fail('Page must return a header content-type with text/');
      }
      html = decode(page.body, page.contentType);
    } catch (err) {
      if (err instanceof UnsafeAddressError || err instanceof FetchPageError) {
        return fail(err.message);
      }
      throw err;
    }
    if (!html.trim()) return fail('Page not found');

    let result: object;
    try {
      ({ result } = await og({ html }));
    } catch {
      return fail('Page has no preview');
    }
    return c.json(OgObjectSchema.parse({ ...result, requestUrl: url }), 200);
  });

  return router;
}

export const openGraphScrapeRoute = createOpenGraphRouter();
