/**
 * Whether `url` is a file in the app's own store (`R2_PUBLIC_URL`, as the upload route answers it): same scheme, host
 * and port, under the store's path. Anything else would have every reader's browser fetch from another server.
 */
export function isFileStoreUrl(url: string, fileStore: string) {
  let file: URL;
  let store: URL;
  try {
    file = new URL(url);
    store = new URL(fileStore);
  } catch {
    return false;
  }
  const base = store.pathname.endsWith('/')
    ? store.pathname
    : `${store.pathname}/`;
  return (
    file.origin === store.origin &&
    file.username === '' &&
    file.password === '' &&
    file.pathname.startsWith(base) &&
    file.pathname.length > base.length
  );
}
