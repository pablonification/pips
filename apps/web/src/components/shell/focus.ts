/**
 * Focus after a navigation (SPEC "Route changes move focus to the h1"). The shell moves focus to the page's title
 * once the new page has rendered. A screen's own title can appear later than that (its data still loading), and on
 * phones the top bar's title it replaces disappears, taking focus with it. So until the member next taps or types,
 * a `PageTitle` that appears takes focus itself, as long as focus is still where the shell put it.
 */
let titleDue = false;
let listening = false;

const visible = (el: HTMLElement) =>
  typeof el.checkVisibility === 'function'
    ? el.checkVisibility()
    : el.offsetParent !== null;

/** The page's own title, else the main landmark. */
export function focusPageTitle() {
  const active = document.activeElement;
  if (active?.closest('[role="dialog"]')) return;
  const title = [
    ...document.querySelectorAll<HTMLElement>('[data-page-title]'),
  ].find(visible);
  (title ?? document.getElementById('isi'))?.focus({ preventScroll: true });
}

/**
 * A screen can keep focus where the member is for one navigation: choosing a row in a split page's list (P1-B's
 * Pengumuman on desktop) opens its post beside the list, and focus stays on the row, not the page's title.
 */
let keepFor: string | null = null;
export function keepFocusOnNavigationTo(pathname: string) {
  keepFor = pathname;
}

/** After a navigation has rendered: focus its title, and let a title that appears later take it. */
export function focusAfterNavigation(pathname?: string) {
  const keep = keepFor !== null && keepFor === pathname;
  keepFor = null;
  if (keep) {
    titleDue = false;
    return;
  }
  if (!listening) {
    listening = true;
    // Once the member acts, focus is theirs again.
    const done = () => (titleDue = false);
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', done, true);
  }
  titleDue = true;
  requestAnimationFrame(focusPageTitle);
}

/** A screen's own title has just appeared (PageTitle, before paint). */
export function titleAppeared(el: HTMLElement) {
  if (!titleDue || !visible(el)) return;
  const active = document.activeElement;
  // Only from where the shell put focus: nothing, the main landmark, or the top bar's title this one replaces.
  const shellFocus =
    !active ||
    active === document.body ||
    active.id === 'isi' ||
    active.classList.contains('g-top-title');
  if (!shellFocus) return;
  titleDue = false;
  el.focus({ preventScroll: true });
}
