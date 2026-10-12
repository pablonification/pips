import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// Starts the real server (`src/index.ts`, as `pnpm start` does) with placeholder settings on a free port in this
// task's range, and checks it answers. The database address leads nowhere; nothing here needs it.
const PORT = Number(process.env.API_START_TEST_PORT ?? 4349);

test(
  'the API still starts and answers after the app/server split',
  { timeout: 60_000 },
  async (t) => {
    usePlaceholderEnv();
    const root = path.resolve(import.meta.dirname, '..');
    const child = spawn(
      path.join(root, 'node_modules/.bin/tsx'),
      ['src/index.ts'],
      {
        cwd: root,
        env: {
          ...process.env,
          PORT: String(PORT),
          LISTEN_HOST: '127.0.0.1',
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    t.after(() => {
      child.kill('SIGTERM');
    });

    const base = `http://127.0.0.1:${PORT}`;
    const deadline = Date.now() + 45_000;
    let res: Response | undefined;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        assert.fail(`the server exited (${child.exitCode}):\n${output}`);
      try {
        res = await fetch(`${base}/`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    assert.ok(res, `the server never answered:\n${output}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Server runs successfully' });
    assert.equal((await fetch(`${base}/api/me`)).status, 401);
    assert.match(output, new RegExp(`Server is running on port ${PORT}`));
  },
);
