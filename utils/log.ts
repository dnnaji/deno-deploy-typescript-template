import * as log from '@std/log';
import { cfg } from 'config';

export async function setupLogger() {
  await log.setup({
    handlers: {
      console: new log.ConsoleHandler(cfg.logLevel as log.LevelName, { // Cast needed
        formatter: (logRecord) => {
          const { msg, args = [], ...rest } = logRecord;
          // Extract correlationId if passed as the first arg
          const correlationId = typeof args[0] === 'string' ? args[0] : 'none';
          return JSON.stringify({
            ...rest,
            message: msg,
            correlationId: correlationId,
          });
        },
      }),
    },
    loggers: {
      default: { level: cfg.logLevel as log.LevelName, handlers: ['console'] },
    },
  });
  return log.getLogger();
}

export function getChildLogger(name: string) {
  return log.getLogger(name);
}
