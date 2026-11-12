/**
 * Whether a share reached the app from another website rather than from this device's share sheet. A share from
 * the share sheet carries no origin, or `null`, so neither is ever refused; a site that hides its origin still
 * gets through. Chrome doesn't show a service worker `Sec-Fetch-Site`, so that header only helps in a browser
 * that passes it on.
 */
export function sharedFromAnotherSite(
  headers: Pick<Headers, 'get'>,
  ownOrigin: string,
): boolean {
  if (headers.get('Sec-Fetch-Site') === 'cross-site') return true;
  const origin = headers.get('Origin');
  return !!origin && origin !== 'null' && origin !== ownOrigin;
}
