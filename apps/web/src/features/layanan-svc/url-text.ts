/**
 * Which `q` in the URL a search box takes as coming from outside (P2-B). The box answers at once and the URL
 * follows with `replace`, a moment behind, so the URL's values are often echoes of what was typed here; those
 * never overwrite the box. A value from outside (a link to this page, search's "Orang") replaces the text.
 *
 * Only values typed since the URL last caught up count as echoes: once the URL shows the latest value written,
 * anything typed before it counts as outside again (P2-B review, finding 3: type "Raka Pratama", clear the box, then
 * open search's "Orang" for Raka, and the box stayed empty).
 */
export function urlEcho(initial = '') {
  let ours = new Set([initial]);
  let last = initial;
  return {
    /** The box wrote `v` to the URL ('' when it was cleared, which removes `q`). */
    wrote(v: string) {
      ours.add(v);
      last = v;
    },
    /** Whether the URL's `q` came from outside; then the box takes it. */
    isOutside(urlQ: string | undefined): boolean {
      const v = urlQ ?? '';
      if (v === last) {
        ours = new Set([v]);
        return false;
      }
      // No `q` (a plain link to the page) keeps what's typed; so does a late echo of an earlier value.
      if (urlQ === undefined || ours.has(v)) return false;
      ours = new Set([v]);
      last = v;
      return true;
    },
  };
}
