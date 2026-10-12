import { useCallback, useSyncExternalStore } from 'react';
import {
  currentTheme,
  getPreference,
  setPreference,
  subscribe,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

export interface ThemeState {
  /** What the member chose: system (default), light or dark. */
  preference: ThemePreference;
  /** The theme on screen now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

/** The theme preference and the resolved theme, kept in sync with the system setting and other tabs. */
export function useTheme(): ThemeState {
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    () => 'system' as const,
  );
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => 'light' as const,
  );
  const set = useCallback((p: ThemePreference) => setPreference(p), []);
  return { preference, theme, setPreference: set };
}
