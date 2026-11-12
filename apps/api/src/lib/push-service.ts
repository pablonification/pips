/** The browsers' push services, by exact host. */
const PUSH_SERVICE_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'jmt17.google.com',
  'web.push.apple.com',
  'updates.push.services.mozilla.com',
]);
/** Windows gives each device a host under this one (wns2-sg2p.notify.windows.com, …). */
const PUSH_SERVICE_SUFFIXES = ['.notify.windows.com'];

/**
 * Whether `endpoint` is at a browser push service, over https on the default port. The API opens a connection to
 * every saved endpoint when it sends a push, so any other address would let a member point the server at
 * machines it can reach.
 */
export function isPushServiceEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (url.username !== '' || url.password !== '') return false;
  const host = url.hostname;
  return (
    PUSH_SERVICE_HOSTS.has(host) ||
    PUSH_SERVICE_SUFFIXES.some(
      (suffix) => host.endsWith(suffix) && host.length > suffix.length,
    )
  );
}
