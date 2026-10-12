import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import tseslint from 'typescript-eslint';

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
    // Playwright's fixtures call \`use()\`, which react-hooks 7 takes for React 19's \`use\`. The e2e code isn't React.
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]);
