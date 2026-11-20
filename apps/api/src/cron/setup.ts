import { env } from '~/configs/env.config';
import { calendarCron } from './calendar-cron';
import { calendarSyncCron } from './calendar-sync';

export function setupCron() {
  if (env.NODE_ENV === 'production') {
    calendarCron.start();
    calendarSyncCron.start();
    // Once now too, so a restart doesn't leave Kalender up to ten minutes behind.
    void calendarSyncCron.fireOnTick();
  }
}
