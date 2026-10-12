export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export declare const THEME_STORAGE_KEY: string;
export declare const THEME_COLORS: Record<ResolvedTheme, string>;
export declare const THEME_PREFERENCES: ThemePreference[];
export declare function parsePreference(value: unknown): ThemePreference;
export declare function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme;
export declare function applyResolvedTheme(
  doc: Document,
  theme: ResolvedTheme,
): void;
