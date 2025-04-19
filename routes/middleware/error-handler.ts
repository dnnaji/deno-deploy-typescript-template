import type { Context } from '@hono/hono'; // Use type import if only types are needed
import { getChildLogger } from '@/utils/log.ts';
import { AppError } from '@/types/errors.ts';

const logger = getChildLogger('error-handler');

export const globalErrorHandler = async (err: Error, c: Context) => {
  const correlationId = c.get('correlationId') || 'unknown';

  logger.error(`Unhandled error: ${err.message}`, correlationId, {
    stack: err.stack,
    cause: err.cause,
  });

  if (err instanceof AppError) {
    return c.json({ error: 'Application error occurred' }, 500);
  }

  return c.json({ error: 'Internal Server Error' }, 500);
};