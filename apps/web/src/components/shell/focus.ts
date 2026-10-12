/** The page's own title after a navigation, else the main landmark (SPEC "Route changes move focus to the h1"). */
export function focusPageTitle() {
  const active = document.activeElement;
  if (active?.closest('[role="dialog"]')) return;
  const visible = (el: HTMLElement) =>
    typeof el.checkVisibility === 'function'
      ? el.checkVisibility()
      : el.offsetParent !== null;
  const title = [
    ...document.querySelectorAll<HTMLElement>('[data-page-title]'),
  ].find(visible);
  (title ?? document.getElementById('isi'))?.focus({ preventScroll: true });
}
