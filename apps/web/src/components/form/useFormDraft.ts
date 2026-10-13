import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDraft, readDraft, writeDraft } from '~/lib/form/draft-store';
import { DRAFT_HOURS, draftKey, type Answers } from '~/lib/form/rules';

/** How long typing pauses before the draft is written. */
export const DRAFT_DEBOUNCE_MS = 400;

/**
 * A member's draft of a form on this device (key `hmif-form-<formId>-<userId>`, 14 days; today's store, see
 * `lib/form/draft-store.ts`). Writes are debounced, and a write still waiting is made when the screen or the page goes
 * away. `clear()` is for after a successful send only.
 */
export function useFormDraft(formId: string, userId: string) {
  const key = draftKey(formId, userId);
  /** Undefined while the device is read; null when there is no draft. */
  const [restored, setRestored] = useState<Answers | null | undefined>(
    undefined,
  );
  const [saved, setSaved] = useState(false);
  const pending = useRef<Answers | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);

  useEffect(() => {
    let live = true;
    setRestored(undefined);
    void readDraft(key, DRAFT_HOURS).then((found) => {
      if (!live) return;
      setRestored(found);
      setSaved(!!found);
    });
    return () => {
      live = false;
    };
  }, [key]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next || cleared.current) return;
    void writeDraft(key, next).then((ok) => {
      if (ok && !cleared.current) setSaved(true);
    });
  }, [key]);

  const save = useCallback(
    (answers: Answers) => {
      cleared.current = false;
      pending.current = answers;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DRAFT_DEBOUNCE_MS);
    },
    [flush],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    cleared.current = true;
    setSaved(false);
    return deleteDraft(key);
  }, [key]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return { restored, saved, save, clear };
}
