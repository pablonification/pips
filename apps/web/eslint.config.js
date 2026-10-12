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
];
/** Files in those folders from before the redesign; C1 deletes them. */
const GARIS_LEGACY = [
  'src/components/icons/home-filled.tsx',
  'src/components/icons/question-mark.tsx',
  'src/components/icons/settings.tsx',
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
    ignores: GARIS_LEGACY,
    plugins: { garis },
    rules: {
      'garis/no-raw-colour': 'error',
      'garis/no-arbitrary-text-size': 'error',
      'garis/no-transition-all': 'error',
      'garis/no-img-icon': [
        'error',
        // The logo is only ever the official image; Media is the one way to show a picture.
        {
          allow: [
            'src/components/garis/HmifLogo.tsx',
            'src/components/garis/Surface.tsx',
          ],
        },
      ],
      'garis/no-icon-library': 'error',
      'garis/no-monospace': 'error',
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
            'accent|success|inverse|outline|error|dialog|handle|rule|hint|dis-ic|msg|t-ic|act|sq|bars',
          ],
        },
      ],
    },
  },
  {
    // Playwright's fixtures call \`use()\`, which react-hooks 7 takes for React 19's \`use\`. The e2e code isn't React.
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]);
