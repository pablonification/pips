import { type ClassValue, clsx } from 'clsx';

/**
 * Joins class names (clsx), without tailwind-merge (8.3 KiB gzip before every page's first render). Garis
 * components take their look from their own `g-*` classes, so a caller's classes add to them and never need to
 * replace a utility.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
