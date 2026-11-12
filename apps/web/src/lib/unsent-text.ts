/**
 * What a member typed and hasn't sent (the composer's draft, a comment, a Curhat message), kept in this tab's
 * sessionStorage so a reload doesn't wipe it: a new version, or a page's code gone after a deploy. Per key (a post,
 * a room). Blank text isn't kept; sending clears it, and `forgetMember` drops all of it. A browser that refuses
 * storage (some private windows) keeps nothing and throws nothing.
 */
type TabStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

const PREFIX = 'pips-unsent:';

function tabStorage(): TabStorage | null {
  try {
    return (
      (globalThis as { sessionStorage?: TabStorage }).sessionStorage ?? null
    );
  } catch {
    return null;
  }
}

export function readUnsent(
  key: string,
  storage: TabStorage | null = tabStorage(),
): string | null {
  try {
    return storage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function keepUnsent(
  key: string,
  text: string,
  storage: TabStorage | null = tabStorage(),
): void {
  try {
    if (text.trim()) storage?.setItem(PREFIX + key, text);
    else storage?.removeItem(PREFIX + key);
  } catch {
    // Full or refused: the text stays on screen, only not across a reload.
  }
}

export function forgetUnsent(storage: TabStorage | null = tabStorage()): void {
  try {
    if (!storage) return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  } catch {
    // Nothing could be kept either.
  }
}
