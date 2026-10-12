/**
 * Which menu button a just-chosen menu item belongs to. A dialog opened from a menu item (the prototype's post menu,
 * then Hapus, then the confirmation) can't return focus to the item: the menu has closed and the item is gone. The
 * Overlay asks here and returns focus to the menu's button instead.
 */
let opener: { el: HTMLElement; at: number } | null = null;

/** Remember the button of the menu that `item` is in. */
export function rememberMenuOpener(item: Element | null) {
  const menu = item?.closest('[role="menu"]');
  const id = menu?.getAttribute('aria-labelledby');
  const el = id ? document.getElementById(id) : null;
  opener = el ? { el, at: Date.now() } : null;
}

/** The button of the menu whose item was chosen just now (within a second), once. */
export function takeMenuOpener(): HTMLElement | null {
  const o = opener;
  opener = null;
  return o && Date.now() - o.at < 1000 && o.el.isConnected ? o.el : null;
}
