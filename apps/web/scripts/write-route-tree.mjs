// Writes src/routeTree.gen.ts from the files in src/routes, once, then exits. Starting Vite does the same through
// the router plugin, which regenerates the tree when its config is resolved.
//   pnpm --filter web routes
import { createServer } from 'vite';

const server = await createServer({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  root: new URL('..', import.meta.url).pathname,
  logLevel: 'warn',
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
});
await server.close();
