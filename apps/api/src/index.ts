/* eslint-disable import/first */
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import './instrument';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Jakarta');

import { serve } from '@hono/node-server';
import { createApp } from './app';
import { env } from './configs/env.config';
import { setupCron } from './cron/setup';
import setupWebsocket from './websocket/setup';
import { listenAddress } from '~/lib/listen';

const app = createApp();

console.log(`Server is running on port ${env.PORT}`);

setupCron();

const httpServer = serve({
  fetch: app.fetch,
  ...listenAddress(env),
});

setupWebsocket(httpServer);
