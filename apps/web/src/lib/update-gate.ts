/**
 * When a new version may take over the tab. The service worker updates itself (`registerType: 'autoUpdate'`); taking
 * over means a reload, which would wipe a text box being typed in or cut off a send. So the reload waits while a box
 * holds text or a send is in flight, and happens on the next move to another page; or the next start, which loads
 * the new version anyway.
 */
/** Sends that live outside React Query (Curhat's outbox), each held while it has something unsent or failed. */
const holds = new Set<() => boolean>();
const onRelease = new Set<() => void>();
const held = () => [...holds].some((unsent) => unsent());

/**
 * Holds a waiting update while `unsent()` is true. Call what it returns when the sends are dropped (the Curhat area
 * closed): a waiting update may then apply, since that cleanup can run after the page change was already seen.
 */
export function holdUpdateWhile(unsent: () => boolean): () => void {
  holds.add(unsent);
  return () => {
    if (holds.delete(unsent)) onRelease.forEach((retry) => retry());
  };
}

export function createUpdateGate({
  typing,
  sending,
  reload,
}: {
  /** A text box on the page holds text. */
  typing: () => boolean;
  /** A send is in flight. */
  sending: () => boolean;
  reload: () => void;
}) {
  let waiting = false;
  const busy = () => sending() || held();
  /** Another page opened: the last page's boxes are gone (kept in the tab, src/lib/unsent-text.ts). */
  const navigated = () => {
    if (!waiting || busy()) return;
    waiting = false;
    reload();
  };
  onRelease.add(navigated);
  return {
    /** The new version is ready. */
    newVersion() {
      if (typing() || busy()) waiting = true;
      else reload();
    },
    navigated,
  };
}

type Field = {
  type: string;
  value: string;
  readOnly: boolean;
  disabled: boolean;
};
const NOT_TEXT = new Set([
  'checkbox',
  'radio',
  'hidden',
  'file',
  'submit',
  'button',
  'reset',
  'image',
  'range',
  'color',
]);

/** Whether any of `fields` (the page's inputs and text areas) holds text a member typed. */
export function holdsText(fields: Iterable<Field>): boolean {
  for (const f of fields)
    if (
      !NOT_TEXT.has(f.type) &&
      !f.readOnly &&
      !f.disabled &&
      f.value.trim() !== ''
    )
      return true;
  return false;
}
