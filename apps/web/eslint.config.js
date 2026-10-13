import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import tseslint from 'typescript-eslint';
import garis from './eslint-rules/garis.mjs';

/**
 * The redesign's folders, where only the Garis design system may be used (SPEC story 150). Each redesign task adds
 * the folders it creates; C1 makes the rules global once the old screens are gone.
 */
export const GARIS_FILES = [
  'src/components/garis/**/*.{ts,tsx}',
  'src/components/icons/**/*.{ts,tsx}',
  'src/lib/theme/**/*.{ts,tsx}',
  'src/routes/dev/**/*.{ts,tsx}',
  'src/dev/**/*.{ts,tsx}',
  // P0-C: the app shell.
  'src/components/shell/**/*.{ts,tsx}',
  'src/lib/shell/**/*.{ts,tsx}',
  // P1-C: push, Profil, Layanan, sign-in and first run.
  'src/components/push/**/*.{ts,tsx}',
  'src/features/**/*.{ts,tsx}',
  // P1-A: Beranda, Kalender, search's sources, and the shared WIB days.
  'src/features/beranda/**/*.{ts,tsx}',
  'src/features/kalender/**/*.{ts,tsx}',
  'src/features/cari/**/*.{ts,tsx}',
  'src/lib/days.ts',
  'src/routes/_app/_left-navbar/index.tsx',
  'src/routes/_app/kalender.tsx',
  'src/routes/_app/kalender/index.tsx',
  // P1-B: Pengumuman, and the shared date words.
  'src/features/pengumuman/**/*.{ts,tsx}',
  'src/lib/dates.ts',
  'src/routes/_app/_left-navbar/pengumuman/route.tsx',
  'src/routes/_app/_left-navbar/pengumuman/index.tsx',
  'src/routes/_app/_left-navbar/pengumuman/$id/index.tsx',
  'src/routes/_app/_left-navbar/pengumuman/tulis/index.tsx',
  // P2-A: Form and Magang SPARTA.
  'src/components/form/**/*.{ts,tsx}',
  'src/lib/form/**/*.{ts,tsx}',
  'src/routes/_app/_left-navbar/layanan/form/index.tsx',
  'src/routes/_app/_left-navbar/layanan/form/$formId.tsx',
  'src/routes/_app/_left-navbar/layanan/sparta/index.tsx',
  // P3-A: Kelola, Live Counting, Rekap Form and Data SPARTA Magang.
  'src/routes/_app/_left-navbar/kelola/index.tsx',
  'src/routes/_app/_left-navbar/kelola/live/index.tsx',
  'src/routes/_app/_left-navbar/kelola/live/$formId/index.tsx',
  'src/routes/_app/_left-navbar/kelola/live/$formId/rekap.tsx',
  'src/routes/_app/_left-navbar/kelola/sparta/index.tsx',
  'src/routes/_app/_left-navbar/kelola/sparta/$submissionId.tsx',
  // P2-B: Ding Dong, Testi Matkul, NIM Finder and Info Lomba.
  'src/features/**/*.{ts,tsx}',
];

// The rules of the previous .eslintrc.cjs, in flat config form. Only TypeScript files are linted, as before.
export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    '**/*.{js,cjs,mjs}',
    'e2e/.build',
    'e2e/.results',
    'e2e/.report',
    'e2e/.out',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      prettierRecommended,
      tailwind.configs.recommended,
    ],
    // ESLint 9 started reporting unused eslint-disable comments by default; ESLint 8 didn't.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      tailwindcss: {
        cssConfigPath: path.join(import.meta.dirname, 'src/index.css'),
      },
    },
    rules: {
      // eslint-plugin-react-hooks 4's recommended set. Version 7's set adds React Compiler rules (not yet).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // New in eslint-plugin-tailwindcss 4's recommended set; not among today's rules.
      'tailwindcss/enforces-canonical-classname': 'off',
      'tailwindcss/important-modifier-suffix': 'off',
    },
  },
  {
    files: GARIS_FILES,
    plugins: { garis },
    rules: {
      'garis/no-raw-colour': 'error',
      'garis/no-arbitrary-text-size': 'error',
      'garis/no-transition-all': 'error',
      'garis/no-img-icon': [
        'error',
        // The logo is only ever the official image; Media shows a picture, Avatar a person's photo.
        {
          allow: [
            'src/components/garis/HmifLogo.tsx',
            'src/components/garis/Surface.tsx',
            'src/components/garis/Avatar.tsx',
          ],
        },
      ],
      'garis/no-icon-library': 'error',
      'garis/no-monospace': 'error',
      'garis/no-added-capitals': 'error',
      // The shell's motion is CSS only (SPEC "Stack and foundations"); no animation library in new code.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'framer-motion',
              message:
                'Motion is CSS-first in the redesign (Garis motion tokens).',
            },
          ],
        },
      ],
      // The design-system component classes (g-*, defined in src/styles/garis/components.css) and their parts.
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          whitelist: [
            'g-[a-z-]+',
            's16|s20|s24|glyph|f|gf|pp|k|o|w|r|c|l|b',
            'gold|paper|ghost|danger|danger-ghost|sm|lg|md|square|wide|round|in-text|full|radio|box|center|on|n',
            'accent|success|inverse|outlined|error|dialog|handle|rule|hint|dis-ic|msg|t-ic|act|sq|bars',
            // The shell's parts (src/styles/garis/shell.css) and the theme scopes.
            'cap|sub|s|lap|label|c2|theme-light|theme-dark',
            // P1-A: Beranda's and Kalender's parts (src/features/beranda/beranda.css, kalender/kalender.css).
            'time|wd|dn|key|out|today|akademik|himpunan|point|past|h|d|tm|draw|two|grow|brief|prev|ext',
            // Pengumuman's parts (src/features/pengumuman/pengumuman.css).
            'who|meta|z|end|many|host|ttl|lbl|in|state|bar|del|opt|body|read|unread|lead|desk|failed',
            // Kelola's parts (src/styles/garis/kelola.css, P3-A).
            'nim|name|v|trk|flip|top',
          ],
        },
      ],
    },
  },
  {
    // The gallery's own page classes (src/dev/garis/gallery.css, ported from the prototype's docs.css).
    files: ['src/dev/garis/**/*.{ts,tsx}'],
    rules: {
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          whitelist: [
            'g-[a-z-]+',
            'gal|gal-[a-z-]+|theme-light|theme-dark|key|cg|no|meta|sw|sks',
            'page|page-head|lede|controls|system|sys-grid|sys-card|wide|scale-table|logo-show|swatches|chip-c',
            'pair-grid|pair|layers|layer|app-icons|appicon|splash|icon-sizes|icons-grid|icon-cell|px-show',
            'kit|kit-panel|kit-fields|wrap|motion-list|voice|note|new-list|rules|tok-grid|tok|demo-row',
            'gold|sm',
          ],
        },
      ],
    },
  },
  {
    // P1-A: no reading or writing refs during render (React's rule; review m9 found one in Tambah acara).
    files: [
      'src/features/beranda/**/*.{ts,tsx}',
      'src/features/kalender/**/*.{ts,tsx}',
      'src/features/cari/**/*.{ts,tsx}',
    ],
    rules: { 'react-hooks/refs': 'error' },
  },
  {
    // Playwright's fixtures call \`use()\`, which react-hooks 7 takes for React 19's \`use\`. The e2e code isn't React.
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]);
