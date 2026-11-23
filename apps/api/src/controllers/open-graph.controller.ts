import og from 'open-graph-scraper';
import { STATUS_CODES } from 'node:http';
import {
  fetchPage,
  FetchPageError,
  MAX_PREVIEW_IMAGE_BYTES,
  previewImageType,
  UnsafeAddressError,
  type FetchPageOptions,
} from '~/lib/safe-fetch';
import { getOpenGraph, getOpenGraphImage } from '~/routes/open-graph.route';
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
 * A page's og:image entries as absolute http(s) addresses, made against the page they came from (after redirects);
 * any other kind (`javascript:`, `data:`) is dropped. The web app shows them through `/open-graph/image`.
 */
export function previewImages(
  images: Array<{ url: string }> | undefined,
  pageUrl: string,
) {
  return images?.flatMap((image) => {
    // A blank one would resolve to the page itself.
    if (!image.url?.trim()) return [];
    try {
      const at = new URL(image.url.trim(), pageUrl);
      return at.protocol === 'https:' || at.protocol === 'http:'
        ? [{ ...image, url: at.href }]
        : [];
    } catch {
      return [];
    }
  });
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
    let pageUrl = url;
    try {
      const page = await fetchPage(url, fetchOptions);
      pageUrl = page.url;
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
    const { ogImage } = result as { ogImage?: Array<{ url: string }> };
    return c.json(
      OgObjectSchema.parse({
        ...result,
        ogImage: previewImages(ogImage, pageUrl),
        requestUrl: url,
      }),
      200,
    );
  });

  router.openapi(getOpenGraphImage, async (c) => {
    const { url } = c.req.valid('query');
    const fail = (error: string) =>
      c.json(
        OpenGraphErrorSchema.parse({ error, errorDetails: {}, success: false }),
        400,
      );
    let page: Awaited<ReturnType<typeof fetchPage>>;
    try {
      // One byte over the limit, so a larger image shows as larger instead of arriving cut.
      page = await fetchPage(url, {
        ...fetchOptions,
        maxBytes: MAX_PREVIEW_IMAGE_BYTES + 1,
      });
    } catch (err) {
      if (err instanceof UnsafeAddressError || err instanceof FetchPageError) {
        return fail(err.message);
      }
      throw err;
    }
    if (page.status >= 400) {
      return fail(
        `${page.status} ${STATUS_CODES[page.status] ?? 'Error'}`.trim(),
      );
    }
    if (page.body.length > MAX_PREVIEW_IMAGE_BYTES)
      return fail('Image too large');
    const type = previewImageType(page.body);
    if (!type) return fail('Not an image');
    return c.body(new Uint8Array(page.body), 200, {
      'Content-Type': type,
      'Cache-Control': `private, max-age=${60 * 60 * 24}`,
      'X-Content-Type-Options': 'nosniff',
      // Opened on its own, the answer is an inert image: no script, no frame, nothing loaded beside it.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // The web app is on the same site (app.hmif.dev and app-api.hmif.dev); no other site may embed it.
      'Cross-Origin-Resource-Policy': 'same-site',
    });
  });

  return router;
}

export const openGraphScrapeRoute = createOpenGraphRouter();
