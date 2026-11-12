import { env } from '~/configs/env.config';
import { calendarCron } from './calendar-cron';

export function setupCron() {
  if (env.NODE_ENV === 'production') {
    calendarCron.start();
  }
}
