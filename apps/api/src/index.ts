/* eslint-disable import/first */
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import './instrument';
import { installUnhandledRejectionLogger } from './lib/background';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Jakarta');
installUnhandledRejectionLogger();

import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './configs/env.config';
import { calendarCron } from './cron/calendar-cron';
import { setupCron } from './cron/setup';
import { closeDatabase } from './db/drizzle';
import setupWebsocket, { getIo } from './websocket/setup';
import { listenAddress } from '~/lib/listen';
import { createShutdown } from '~/lib/shutdown';

const app = createApp();

console.log(`Server is running on port ${env.PORT}`);

setupCron();

const httpServer = serve({
  fetch: app.fetch,
  ...listenAddress(env),
});

setupWebsocket(httpServer);

const shutdown = createShutdown({
  stopJobs: () => {
    calendarCron.stop();
  },
  closeServer: async () => {
    const server = httpServer as Server;
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeIdleConnections();
    });
  },
  closeSockets: async () => {
    const io = getIo();
    io.disconnectSockets(true);
    io.engine.close();
  },
  closeDatabase: async () => {
    await closeDatabase();
  },
  exit: (code) => process.exit(code),
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
