/**
 * A page with a gold cover (a form, in every layout): the phone and tablet top bar turns gold and drops its title
 * (the cover has it), the browser's bar turns gold with it, and on desktop the breadcrumbs sit on the gold band. A
 * page may also take over Back while it is in a step of its own (a form's agreement step goes back to its questions).
 * The page says so with `useCover()`; the shell reads it with `useCovered()`.
 */
import { useLocation } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';

export interface CoverBack {
  label: string;
  run: () => void;
}

interface Cover {
  pathname: string;
  back: CoverBack | null;
}

let current: Cover | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The page has a gold cover; `back` replaces the shell's Back while it is set. */
export function useCover(back: CoverBack | null = null) {
  const { pathname } = useLocation();
  const label = back?.label;
  const run = back?.run;
  useEffect(() => {
    const mine: Cover = {
      pathname,
      back: label && run ? { label, run } : null,
    };
    current = mine;
    emit();
    return () => {
      if (current === mine) {
        current = null;
        emit();
      }
    };
  }, [pathname, label, run]);
}

/** The cover of the page at `pathname`, or null. */
export function useCovered(pathname: string): Cover | null {
  const c = useSyncExternalStore(subscribe, () => current);
  return c && c.pathname === pathname ? c : null;
}
