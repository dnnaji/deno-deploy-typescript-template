import { Hono } from '@hono/hono';
import { cors } from '@hono/hono/cors';
import v1Router from '@/routes/v1/index.ts';
import { setupLogger, getChildLogger } from '@/utils/log.ts';
import { createAuthMiddleware } from '@/middleware/auth.ts';
import { globalErrorHandler } from '@/middleware/error-handler.ts';
import { simpleRateLimiter } from '@/middleware/rate-limiter.ts';
import { cfg } from 'config';
import { scheduleDailyReport } from '@/jobs/daily-report.ts'; // Import scheduler

const logger = await setupLogger();
const app = new Hono();

// --- Global Middleware ---
app.use('*', async (c, next) => {
  const correlationId = crypto.randomUUID();
  c.set('correlationId', correlationId);
  // Pass correlationId to logger context
  (c as any).log = (level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) => {
    const childLogger = getChildLogger('request-context');
    childLogger[level](message, correlationId, ...args);
  };
  await next();
});

app.use('*', async (c, next) => {
  (c as any).log('debug', `Incoming: ${c.req.method} ${c.req.path}`);
  await next();
});

app.use(
  '*',
  cors({
    origin: cfg.isProd ? ['https://your-frontend.com'] : '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  })
);

if (cfg.isProd) {
  logger.warn('Using simple in-memory rate limiter in production - replace with distributed solution (Redis/KV)');
}
app.use('*', simpleRateLimiter);

app.get('/health', (c) => c.text('ok'));

app.use('*', createAuthMiddleware());

// --- Routing ---
app.route('/v1', v1Router);

// --- Error Handling ---
app.onError(globalErrorHandler);

// --- Schedule Jobs ---
scheduleDailyReport(); // Schedule the job

// --- Server Start ---
logger.info(`Server starting on port ${cfg.port} in ${cfg.isProd ? 'production' : 'development'} mode`);
Deno.serve({ port: cfg.port }, app.fetch);