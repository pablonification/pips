import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { VitePluginRadar } from 'vite-plugin-radar';

/**
 * Writes dist/.vite/chunk-modules.json: for each JS chunk, the modules in it (npm packages by name, app files by
 * path). The budget check (scripts/budgets.mjs) uses it to say which packages each route loads before its first
 * render, e.g. that socket.io-client loads only with Curhat and Live Counting.
 */
function chunkModules(): Plugin {
  return {
    name: 'pips-chunk-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      const root = path.resolve(import.meta.dirname);
      const chunks: Record<string, string[]> = {};
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const modules = new Set<string>();
        for (const id of output.moduleIds) {
          const file = id.replace(/\?.*$/, '').replace(/^\0/, '');
          const pkg =
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
              file,
            );
          modules.add(pkg ? `npm:${pkg[1]}` : path.relative(root, file));
        }
        chunks[output.fileName] = [...modules].sort();
      }
      this.emitFile({
        type: 'asset',
        fileName: '.vite/chunk-modules.json',
        source: `${JSON.stringify(chunks, null, 1)}\n`,
      });
    },
  };
}

/**
 * Leaves the review prototypes (public/prototypes/, copied in by setup.sh, not in Git) out of production builds.
 * The dev server still serves them (staging and the owner's review); scripts/verify-production-bundle.mjs fails
 * a build that has them.
 */
function noPrototypes(): Plugin {
  let outDir = '';
  return {
    name: 'pips-no-prototypes',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      rmSync(path.join(outDir, 'prototypes'), { recursive: true, force: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const appName = env.VITE_APP_NAME || 'PIPS!';
  const analyticsId = env.VITE_ANALYTICS_ID || null;
  // Where the dev server sends API requests. Not VITE_-prefixed, so it never reaches the bundle.
  // Staging's API listens on 5000; on a Mac (AirPlay owns 5000) set DEV_API_ORIGIN, e.g. http://127.0.0.1:5100.
  const apiOrigin =
    loadEnv(mode, process.cwd(), 'DEV_API_ORIGIN').DEV_API_ORIGIN ||
    'http://127.0.0.1:5000';
  return {
    define: {
      __TEST_LOGIN_ENABLED__: JSON.stringify(
        (mode === 'development' || mode === 'staging') &&
          env.VITE_ENABLE_TEST_LOGIN === 'true',
      ),
      // The design-system gallery (/dev/garis) stays out of production builds; e2e/vite.e2e.config.ts turns it on.
      __GARIS_GALLERY__: JSON.stringify(mode !== 'production'),
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: ['staging.hmif.dev'],
      proxy: {
        '/api': apiOrigin,
        '/socket.io': { target: apiOrigin, ws: true },
        '/swagger': apiOrigin,
        '/doc': apiOrigin,
      },
    },
    resolve: {
      alias: {
        '~': path.resolve(import.meta.dirname, './src'),
      },
    },

    plugins: [
      ...(analyticsId
        ? [
            VitePluginRadar({
              analytics: {
                id: analyticsId,
              },
            }),
          ]
        : []),
      VitePWA({
        strategies: 'injectManifest',
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
          type: 'module',
        },
        srcDir: 'src',
        filename: 'sw.ts',
        // Icons: scripts/icons/build-icons.py, the official logo on ink.
        manifest: {
          name: appName,
          short_name: appName,
          description: 'Aplikasi resmi Himpunan Mahasiswa Informatika ITB',
          // F2-007: the app is Indonesian (vite-plugin-pwa's default was "en").
          lang: 'id',
          icons: [
            {
              src: '/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/android-chrome-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/android-chrome-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          // F2-008: the install sheet's picture of the app is the redesigned sign-in (a capture at 390 × 844, 2×), not
          // today's green English screen; its label is new copy, listed for the owner.
          screenshots: [
            {
              sizes: '780x1688',
              src: '/img/ss/masuk.jpg',
              type: 'image/jpeg',
              form_factor: 'narrow',
              label: 'Halaman masuk PIPS!',
            },
          ],
          start_url: '/',
          scope: '/',
          // Long-press shortcuts on the installed app's icon: the primary destinations' URLs.
          shortcuts: [
            { name: 'Pengumuman', url: '/pengumuman' },
            { name: 'Kalender', url: '/kalender' },
            { name: 'Layanan', url: '/layanan' },
          ],
          // The app background (tokens.css --bg-app, light), so the status bar blends with the top bar; the splash is
          // the official logo on ink (SPEC "Design tokens and theming"), so its background is HMIF's ink.
          theme_color: '#FCFBF8',
          background_color: '#1B1508',
          display: 'standalone',
          share_target: {
            action: '/share-file-handler',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'images',
                  accept: ['image/*'],
                },
              ],
            },
          },
        },
        // The service worker (src/sw.ts) caches only what this precaches plus same-origin images; see its header.
        // Precache: the app shell and every route chunk, never the review prototypes or other review material.
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,woff2}', 'logo/hmif.png'],
          globIgnores: ['prototypes/**', '**/*.map'],
        },
      }),
      // The router plugin must come before the React plugin. Every page's component loads on demand; the two layouts
      // every signed-in page sits in (the shell, and the layout under it) load with the app instead of as two more
      // requests (P1-A round 2, the request budget). Sign-in loads them too: 4 KiB gzip.
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        codeSplittingOptions: {
          splitBehavior: ({ routeId }) =>
            routeId === '/_app' || routeId === '/_app/_left-navbar'
              ? []
              : undefined,
        },
      }),
      react(),
      tailwindcss(),
      chunkModules(),
      noPrototypes(),
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG || 'hmif',
        project: env.SENTRY_PROJECT || 'hmif-app-fe',
        disable: !env.VITE_SENTRY_DSN,
      }),
    ],

    build: {
      sourcemap: true,
      // dist/.vite/manifest.json: chunks and their imports, read by the budget check (scripts/budgets.mjs).
      manifest: true,
      // One stylesheet: the routes' own CSS is 1–2 KiB gzip each, less than a request costs (SPEC: ≤ 15 requests
      // before Beranda's content).
      cssCodeSplit: false,
      // Fewer, larger chunks without loading code a route doesn't use (P1-A round 2; Beranda went from 49 scripts
      // before its content to 4, and every route got lighter). Measured by the journey "a cold first load asks for at
      // most 15 resources of any kind" (e2e/journeys/beranda.spec.ts).
      rolldownOptions: {
        // F2-004: the Garis components, the icons and the push module do nothing when imported (no CSS imports, no
        // registration), so a page that imports one of them through an index (src/components/garis/index.ts,
        // components/push/index.ts) no longer carries every other one, the dialogs, menus and popovers with Radix and
        // Floating UI, before its first render. tests/garis-pure.test.mjs keeps them free of import-time effects.
        treeshake: {
          moduleSideEffects: [
            {
              test: /[\\/]src[\\/]components[\\/](garis|icons|push)[\\/][^\\/]+\.tsx?$/,
              sideEffects: false,
            },
          ],
        },
        output: {
          codeSplitting: {
            groups: [
              // Everything the entry loads before any route, in the entry's own file.
              { name: 'app', tags: ['$initial'], priority: 4 },
              // Small leaves most screens share: the Garis icons, the copy, Kalender's pieces that Beranda,
              // Kalender and search share, and the push state and prompt (Beranda, first run, Notifikasi and search
              // use them; on their own they were two more requests before Beranda's content).
              {
                name: 'ui',
                test: /[\\/]src[\\/](components[\\/](icons|push)|copy|features[\\/]kalender)[\\/]/,
                minShareCount: 2,
                priority: 3,
              },
              // Other shared code: one chunk per set of routes that use it, so no route loads code it doesn't use.
              {
                name: 'shared',
                test: /[\\/]src[\\/]/,
                minShareCount: 2,
                entriesAware: true,
                priority: 2,
              },
              {
                name: 'vendor',
                test: /node_modules/,
                minShareCount: 2,
                entriesAware: true,
                priority: 1,
              },
            ],
          },
          // The shared chunks' names list every route that uses them; keep the file names short.
          chunkFileNames: (chunk) =>
            /^(shared|vendor)~/.test(chunk.name)
              ? 'assets/shared-[hash].js'
              : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
