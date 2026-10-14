import { type ClassValue, clsx } from 'clsx';

/**
 * Joins class names (clsx). F2-004: without tailwind-merge (8.3 KiB gzip before every page's first render). Garis
 * components take their look from their own `g-*` classes, so a caller's classes add to them and never need to
 * replace a utility; the one component that offered a replaceable utility (`Saved`'s text colour) now takes the
 * caller's instead of its default.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
