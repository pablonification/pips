/**
 * A room opened from Mulai ruang baru starts with the composer focused (app.js `new-room`), instead of the page's
 * title where the shell puts focus after a navigation.
 */
let composerWanted = false;

export function wantComposerFocus() {
  composerWanted = true;
}

/** Whether the room just opened should focus its composer (once). */
export function takeComposerFocus(): boolean {
  const wanted = composerWanted;
  composerWanted = false;
  return wanted;
}

/** The page's scrolling area (the shell's, P0-C). */
export const scroller = () =>
  document.querySelector<HTMLElement>('[data-scroll-restoration-id="isi"]');

/** How close to the end still counts as "at the newest message". */
const NEAR_END_PX = 48;

export function atEnd(el: HTMLElement | null): boolean {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_END_PX;
}

export function scrollToEnd() {
  const el = scroller();
  if (el) el.scrollTop = el.scrollHeight;
}
