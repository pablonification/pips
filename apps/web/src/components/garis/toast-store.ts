/**
 * The toast queue, separate from React so any code can raise a toast. Timing rules:
 * success toasts stay at least 5 s (8 s with an undo action); error toasts stay until the
 * member dismisses them.
 */
export type ToastTone = 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  /** Milliseconds before it leaves by itself; null: stays until dismissed. */
  duration: number | null;
}

export const SUCCESS_MS = 5000;
export const SUCCESS_WITH_ACTION_MS = 8000;
/** At most this many toasts at once: the oldest success leaves first. Errors are never removed to make room. */
export const MAX_TOASTS = 3;

export function toastDuration(
  tone: ToastTone,
  hasAction: boolean,
  requested?: number,
): number | null {
  if (tone === 'error') return null;
  const floor = hasAction ? SUCCESS_WITH_ACTION_MS : SUCCESS_MS;
  return Math.max(floor, requested ?? floor);
}

type Listener = (items: ToastItem[]) => void;

type TimerHandle = ReturnType<typeof setTimeout>;

export function createToastStore(
  timers: {
    set: (fn: () => void, ms: number) => TimerHandle;
    clear: (handle: TimerHandle) => void;
  } = {
    // Through an arrow: browsers throw "Illegal invocation" when setTimeout is called as this object's method, and
    // a fake clock in tests wouldn't show it.
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle),
  },
) {
  let items: ToastItem[] = [];
  let next = 1;
  const listeners = new Set<Listener>();
  const handles = new Map<number, TimerHandle>();
  const emit = () => listeners.forEach((l) => l(items));

  function dismiss(id: number) {
    const h = handles.get(id);
    if (h !== undefined) timers.clear(h);
    handles.delete(id);
    const before = items.length;
    items = items.filter((t) => t.id !== id);
    if (items.length !== before) emit();
  }

  function show(
    tone: ToastTone,
    message: string,
    opts: { action?: ToastAction; duration?: number } = {},
  ) {
    const item: ToastItem = {
      id: next++,
      tone,
      message,
      action: opts.action,
      duration: toastDuration(tone, Boolean(opts.action), opts.duration),
    };
    items = [...items, item];
    // Make room by removing older successes only: errors stay until dismissed, and the new toast always shows, so
    // the stack can go over the limit when it is full of errors.
    while (items.length > MAX_TOASTS) {
      const oldest = items.find((t) => t.tone !== 'error' && t.id !== item.id);
      if (!oldest) break;
      dismiss(oldest.id);
    }
    if (item.duration !== null)
      handles.set(
        item.id,
        timers.set(() => dismiss(item.id), item.duration),
      );
    emit();
    return item.id;
  }

  return {
    success: (
      message: string,
      opts?: { action?: ToastAction; duration?: number },
    ) => show('success', message, opts),
    error: (message: string, opts?: { action?: ToastAction }) =>
      show('error', message, opts),
    dismiss,
    get: () => items,
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const toast = createToastStore();
