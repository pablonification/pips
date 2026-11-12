import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

interface RunningServer {
  base: string;
  child: ChildProcess;
  output: () => string;
  /** Resolves with the exit code (or signal) once the process has ended. */
  exited: Promise<number | string | null>;
  /** SIGTERM (tsx passes it on to the server; SIGKILL would leave the server running), then waits for the exit. */
  stop: () => Promise<number | string | null>;
}

/**
 * Starts the real server (`src/index.ts`, as `pnpm start` does) with placeholder settings on `port`, and waits until
 * it answers `/`. The database address leads nowhere unless `env` sets one. The caller stops it (`stop`).
 */
export async function startServer(
  port: number,
  env: Record<string, string> = {},
): Promise<RunningServer> {
  usePlaceholderEnv();
  const root = path.resolve(import.meta.dirname, '../..');
  const child = spawn(
    path.join(root, 'node_modules/.bin/tsx'),
    ['src/index.ts'],
    {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        LISTEN_HOST: '127.0.0.1',
        NODE_ENV: 'development',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const exited = new Promise<number | string | null>((resolve) =>
    child.on('exit', (code, signal) => resolve(code ?? signal)),
  );

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`the server exited (${child.exitCode}):\n${output}`);
    }
    try {
      await fetch(`${base}/`);
      const stop = async () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
        }
        return await exited;
      };
      return { base, child, output: () => output, exited, stop };
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  child.kill('SIGTERM');
  throw new Error(`the server never answered:\n${output}`);
}
