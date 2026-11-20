/**
 * Focused flows (src/lib/shell/routes.ts `focused`): no tab bar or rail on phones and tablets. Kept here because the
 * e2e build can't import the app's route table; tests/focused-routes.test.ts fails when the two differ.
 */
export const FOCUSED_ROUTES: readonly string[] = [
  '/pengumuman/tulis',
  '/layanan/curhat/$roomId',
  '/layanan/form/$formId',
  '/layanan/sparta',
  '/kelola/curhat/$roomId',
  '/mulai',
  '/hubungkan',
];
