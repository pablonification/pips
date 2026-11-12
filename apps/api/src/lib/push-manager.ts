import webpush from 'web-push';
import { env } from '~/configs/env.config';
import { logger } from '~/logger';
import { isPushServiceEndpoint } from './push-service';

webpush.setVapidDetails(
  'mailto:' + env.VAPID_MAILTO,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export interface PushData {
  title: string;
  options?: {
    actions?: Array<{
      action: string;
      title: string;
      icon?: string;
    }>;
    badge?: string;
    data?: any;
    body?: string;
    icon?: string;
    image?: string;
    tag?: string;
    timestamp?: number;
    url?: string;
  };
}

/**
 * The most a push's JSON may take, in UTF-8 bytes. Push services refuse a payload over 4,096 bytes after encryption
 * (413), and encryption adds about 100; 3,000 leaves room and is far more than a notification shows.
 */
export const MAX_PUSH_PAYLOAD_BYTES = 3000;
/** How many pushes are in flight at once: a burst to 2,000 devices no longer opens 2,000 connections together. */
export const PUSH_CONCURRENCY = 50;
/** A push service that hasn't answered by then is given up on, so a stalled one can't hold a fan-out open. */
export const PUSH_TIMEOUT_MS = 10_000;

const utf8 = new TextEncoder();
const byteLength = (text: string) => utf8.encode(text).length;

/** Characters as people see them (an emoji with its modifiers is one), so a cut never splits one. */
function graphemes(text: string): string[] {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (s) => s.segment,
  );
}

/** The longest start of `text` that, ending in "…", keeps `fits` true; "" when not even that fits. */
function longestFitting(text: string, fits: (candidate: string) => boolean) {
  const parts = graphemes(text);
  let low = 0;
  let high = parts.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(parts.slice(0, mid).join('').trimEnd() + '…')) low = mid;
    else high = mid - 1;
  }
  return low === 0 ? '' : parts.slice(0, low).join('').trimEnd() + '…';
}

/**
 * The push as sent: unchanged when its JSON fits in `maxBytes`, otherwise with its body (then, if need be, its title)
 * cut short with "…". A post's whole text used to go out, so a long announcement was refused for every member.
 */
export function fitPushData(
  data: PushData,
  maxBytes: number = MAX_PUSH_PAYLOAD_BYTES,
): PushData {
  const size = (d: PushData) => byteLength(JSON.stringify(d));
  if (size(data) <= maxBytes) return data;
  const withBody = (body: string): PushData => ({
    ...data,
    options: { ...data.options, body },
  });
  const body = data.options?.body ?? '';
  const shorter = withBody(
    longestFitting(body, (b) => size(withBody(b)) <= maxBytes),
  );
  if (size(shorter) <= maxBytes) return shorter;
  const withTitle = (title: string): PushData => ({ ...shorter, title });
  return withTitle(
    longestFitting(data.title, (t) => size(withTitle(t)) <= maxBytes),
  );
}

export interface SendOptions {
  urgency?: webpush.Urgency;
  /** For tests; the real sender otherwise. */
  send?: typeof webpush.sendNotification;
  timeoutMs?: number;
  concurrency?: number;
  /** For tests; the API's logger otherwise. */
  log?: (summary: PushSummary) => void;
}

/** One fan-out's outcome in counts: never an endpoint, a member or the push's text. */
export interface PushSummary {
  type: 'push';
  devices: number;
  sent: number;
  /** Answered 404 or 410: pruned by the caller. */
  gone: number;
  /** By the push service's status code, or `error` when none answered (a timeout, a network error). */
  failed: Record<string, number>;
  /** Saved before the API checked endpoints, and not at a push service: never connected to. */
  skipped: number;
}

function summarize(
  devices: number,
  skipped: number,
  results: PromiseSettledResult<Awaited<ReturnType<typeof sendNotification>>>[],
): PushSummary {
  const summary: PushSummary = {
    type: 'push',
    devices,
    sent: 0,
    gone: 0,
    failed: {},
    skipped,
  };
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) summary.sent += 1;
    else {
      const code =
        r.status === 'fulfilled' && !r.value.success
          ? r.value.error.statusCode
          : undefined;
      if (code === 404 || code === 410) summary.gone += 1;
      else {
        const key = code === undefined ? 'error' : String(code);
        summary.failed[key] = (summary.failed[key] ?? 0) + 1;
      }
    }
  }
  return summary;
}

/**
 *
 * send notification to a single subscriber.
 * If success, return the send result, otherwise return the error and the given endpoint.
 * A push service that doesn't answer within `timeoutMs` rejects it.
 */
export async function sendNotification(
  pushSubscription: webpush.PushSubscription,
  data: PushData,
  options: SendOptions = {},
): Promise<
  | { success: true; result: webpush.SendResult }
  | { success: false; error: webpush.WebPushError; endpoint: string }
> {
  const {
    send = webpush.sendNotification.bind(webpush),
    timeoutMs = PUSH_TIMEOUT_MS,
    urgency,
  } = options;
  let timer: NodeJS.Timeout | undefined;
  try {
    return {
      success: true,
      result: await Promise.race([
        send(pushSubscription, JSON.stringify(fitPushData(data)), {
          ...(urgency ? { urgency } : {}),
          timeout: timeoutMs,
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Push timed out after ${timeoutMs} ms`));
          }, timeoutMs);
        }),
      ]),
    };
  } catch (err) {
    if (err instanceof webpush.WebPushError) {
      return {
        success: false,
        error: err,
        endpoint: pushSubscription.endpoint,
      };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 *
 * send notification to all subscriptions using sendNotification function, at most `concurrency` at a time.
 * Subscriptions not at a push service are left out. The results are in the remaining subscriptions' order, as
 * `Promise.allSettled` gives them. Logs one line of counts.
 */
export async function sendNotificationToAll(
  subscriptions: webpush.PushSubscription[],
  data: PushData,
  options: SendOptions = {},
) {
  const {
    concurrency = PUSH_CONCURRENCY,
    log = (summary) => logger.info(summary),
  } = options;
  const pushSubscriptions = subscriptions.filter((s) =>
    isPushServiceEndpoint(s.endpoint),
  );
  const fitted = fitPushData(data);
  const results = new Array<
    PromiseSettledResult<Awaited<ReturnType<typeof sendNotification>>>
  >(pushSubscriptions.length);
  let next = 0;
  const worker = async () => {
    while (next < pushSubscriptions.length) {
      const index = next++;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await sendNotification(
            pushSubscriptions[index],
            fitted,
            options,
          ),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), pushSubscriptions.length) },
      worker,
    ),
  );
  log(
    summarize(
      subscriptions.length,
      subscriptions.length - pushSubscriptions.length,
      results,
    ),
  );
  return results;
}
