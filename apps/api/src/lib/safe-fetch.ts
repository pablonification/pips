import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/**
 * Fetching a page someone named (link previews) without reaching inside the network: only http(s) on the usual
 * ports, only public addresses (checked on the address actually connected to, so a name that resolves somewhere
 * else the second time can't slip through), redirects followed here and checked the same way, and a cap on time
 * and size.
 */

const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 96], // unspecified, loopback and IPv4-compatible (::a.b.c.d, deprecated, can embed any IPv4 address)
  ['::ffff:0:0:0', 96], // IPv4-translated (SIIT), can embed any IPv4 address
  ['64:ff9b::', 96], // NAT64, can embed any IPv4 address
  ['64:ff9b:1::', 48], // local NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, can embed any IPv4 address
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv6');
}

/** Whether an IP address is on the public internet (not loopback, private, link-local, metadata or reserved). */
export function isPublicAddress(ip: string) {
  const family = net.isIP(ip);
  if (family === 0) return false;
  return !BLOCKED.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

export class UnsafeAddressError extends Error {
  constructor(message = 'Address not allowed') {
    super(message);
    this.name = 'UnsafeAddressError';
  }
}

export class FetchPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchPageError';
  }
}

export interface FetchPageOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Which resolved addresses may be connected to; tests widen it to their own server. */
  isAllowedAddress?: (ip: string) => boolean;
  /** Which ports may be connected to (the scheme's default when the address names none). */
  ports?: readonly number[];
}

interface FetchedPage {
  /** The address finally fetched, after redirects. */
  url: string;
  status: number;
  contentType: string;
  /** At most `maxBytes`: a longer page is cut there (a preview needs only its head). */
  body: Buffer;
}

const DEFAULTS = {
  timeoutMs: 5000,
  maxBytes: 1024 * 1024,
  maxRedirects: 5,
  isAllowedAddress: isPublicAddress,
  ports: [80, 443],
} satisfies Required<FetchPageOptions>;

/** Checks an address before connecting: scheme, credentials, port and, for an IP written out, the IP itself. */
function checkUrl(
  raw: string,
  options: Pick<FetchPageOptions, 'isAllowedAddress' | 'ports'> = {},
) {
  const { isAllowedAddress, ports } = { ...DEFAULTS, ...options };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeAddressError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeAddressError('Only http and https addresses');
  }
  if (url.username || url.password) throw new UnsafeAddressError();
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;
  if (!ports.includes(port)) throw new UnsafeAddressError();
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isAllowedAddress(host)) throw new UnsafeAddressError();
  return url;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

/** `dns.lookup` that refuses a name if any of its addresses isn't allowed. */
function guardedLookup(isAllowedAddress: (ip: string) => boolean) {
  return (
    hostname: string,
    options: dns.LookupOptions,
    callback: LookupCallback,
  ) => {
    dns.lookup(
      hostname,
      { all: true, family: options.family ?? 0 },
      (err, addresses) => {
        if (err) {
          callback(err, []);
          return;
        }
        if (
          addresses.length === 0 ||
          addresses.some((a) => !isAllowedAddress(a.address))
        ) {
          callback(new UnsafeAddressError(), []);
          return;
        }
        if (options.all) {
          callback(null, addresses);
          return;
        }
        callback(null, addresses[0].address, addresses[0].family);
      },
    );
  };
}

async function requestOnce(
  url: URL,
  options: Required<FetchPageOptions>,
  signal: AbortSignal,
) {
  return await new Promise<{
    status: number;
    location?: string;
    contentType: string;
    body: Buffer;
  }>((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'text/html',
          'Accept-Encoding': 'identity',
          'User-Agent':
            'Mozilla/5.0 (compatible; PIPS-LinkPreview/1.0; +https://app.hmif.dev)',
        },
        lookup: guardedLookup(options.isAllowedAddress) as never,
        // No connection reuse: every request resolves and checks its address again.
        agent: false,
        signal,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({
            status,
            location: res.headers.location,
            contentType,
            body: Buffer.alloc(0),
          });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({
            status,
            contentType,
            body: Buffer.concat(chunks).subarray(0, options.maxBytes),
          });
        };
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= options.maxBytes) {
            finish();
            res.destroy();
          }
        });
        res.on('end', finish);
        res.on('error', (err) => {
          if (!done) reject(err);
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Fetches a public page under the limits above. Throws `UnsafeAddressError` or `FetchPageError`. */
export async function fetchPage(
  raw: string,
  options: FetchPageOptions = {},
): Promise<FetchedPage> {
  const opts: Required<FetchPageOptions> = { ...DEFAULTS, ...options };
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let url = checkUrl(raw, opts);
  for (let redirects = 0; ; redirects++) {
    let res;
    try {
      res = await requestOnce(url, opts, signal);
    } catch (err) {
      if (err instanceof UnsafeAddressError) throw err;
      if (signal.aborted) {
        throw new FetchPageError('The operation was aborted due to timeout');
      }
      throw new FetchPageError('Page not found');
    }
    if (res.location !== undefined) {
      if (redirects >= opts.maxRedirects) {
        throw new FetchPageError('Too many redirects');
      }
      url = checkUrl(new URL(res.location, url).toString(), opts);
      continue;
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: res.contentType,
      body: res.body,
    };
  }
}
