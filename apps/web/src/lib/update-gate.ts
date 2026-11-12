/**
 * When a new version may take over the tab. The service worker updates itself (`registerType: 'autoUpdate'`); taking
 * over means a reload, which would wipe a text box being typed in or cut off a send. So the reload waits while a box
 * holds text or a send is in flight, and happens on the next move to another page; or the next start, which loads
 * the new version anyway.
 */
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
  return {
    /** The new version is ready. */
    newVersion() {
      if (typing() || sending()) waiting = true;
      else reload();
    },
    /** Another page opened: the last page's boxes are gone (kept in the tab, src/lib/unsent-text.ts). */
    navigated() {
      if (!waiting || sending()) return;
      waiting = false;
      reload();
    },
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
