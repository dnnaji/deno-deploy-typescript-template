import { cfg } from 'config';
import { getChildLogger } from '@/utils/log.ts';

const logger = getChildLogger('daily-report');

export async function runDailyReport() {
  logger.info('Running daily report job');
  if (cfg.cron.enabled) {
    logger.info('Job completed');
    // Add actual report logic here
  } else {
    logger.warn('Cron is disabled, skipping daily report job execution.');
  }
}

export function scheduleDailyReport() {
  if (cfg.cron.enabled) {
    logger.info(
      `Scheduling daily report with pattern: ${cfg.cron.dailyReport}`,
    );
    Deno.cron('Daily Report Job', cfg.cron.dailyReport, async () => {
      // TODO: Add locking mechanism here (e.g., using Deno KV or Redis)
      // to prevent multiple instances running simultaneously.
      logger.info('Daily report cron triggered.');
      await runDailyReport();
    });
  } else {
    logger.warn('Daily report cron job scheduling is disabled via config.');
  }
}
