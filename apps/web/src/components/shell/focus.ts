/**
 * Focus after a navigation (SPEC "Route changes move focus to the h1"). The shell moves focus to the page's title
 * once the new page has rendered. A screen's own title can arrive later than that (its route's code or data still
 * loading), and on phones the top bar's title it replaces disappears, taking focus with it: so for a moment after
 * a navigation, a `PageTitle` that appears takes focus itself, as long as focus is still where the shell put it.
 */
let titleDueUntil = 0;

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

/** After a navigation has rendered: focus its title, and let a title that arrives within 2 s take it. */
export function focusAfterNavigation() {
  titleDueUntil = performance.now() + 2000;
  requestAnimationFrame(focusPageTitle);
}

/** A screen's own title has just appeared (PageTitle, before paint). */
export function titleAppeared(el: HTMLElement) {
  if (performance.now() > titleDueUntil || !visible(el)) return;
  const active = document.activeElement;
  // Only from where the shell put focus: nothing, the main landmark, or the top bar's title this one replaces.
  const shellFocus =
    !active ||
    active === document.body ||
    active.id === 'isi' ||
    active.classList.contains('g-top-title');
  if (!shellFocus) return;
  titleDueUntil = 0;
  el.focus({ preventScroll: true });
}
