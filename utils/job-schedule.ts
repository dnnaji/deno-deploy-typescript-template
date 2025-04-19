// utils/job-schedule.ts
import { parseExpression } from 'npm:cron-parser';
import { getChildLogger } from '@/utils/log.ts';

const logger = getChildLogger('job-schedule');

/**
 * Checks if a job is due based on its cron schedule and last run time.
 * @param cronExpr The cron expression string.
 * @param lastRun Epoch milliseconds of the last successful run completion.
 * @param now Current epoch milliseconds.
 * @returns True if the job should run now, false otherwise.
 */
export function isDue(
  cronExpr: string,
  lastRun: number,
  now: number
): boolean {
  try {
    // Get the *previous* scheduled time based on 'now'
    const interval = parseExpression(cronExpr, { currentDate: now });
    const prevScheduledTime = interval.prev().getTime();

    // A job is due if:
    // 1. A scheduled time has passed (`prevScheduledTime <= now`).
    // 2. The last successful run was *before* that previous scheduled time.
    // This prevents re-running if the scheduler restarts slightly after the exact minute.
    const shouldRun = prevScheduledTime <= now && lastRun < prevScheduledTime;

    // logger.debug(
    //   `isDue check: expr='${cronExpr}', lastRun=${lastRun}, now=${now}, prevSched=${prevScheduledTime}, result=${shouldRun}`
    // );

    return shouldRun;
  } catch (e) {
    logger.error(`Failed to parse cron expression: ${cronExpr}`, e);
    return false; // Don't run if the expression is invalid
  }
}