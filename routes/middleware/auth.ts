import { bearerAuth } from '@hono/hono/bearer-auth';
import { secureHeaders } from '@hono/hono/secure-headers';
import type { Context, Next } from '@hono/hono';
import { cfg } from 'config';

export const createAuthMiddleware = () => {
  const auth = bearerAuth({ token: cfg.apiToken });
  const secure = secureHeaders();

  return async (c: Context, next: Next) => {
    // Skip auth for health check and dev mode
    if (c.req.path === '/health' || cfg.isDev) {
      await next();
      return;
    }
    try {
      await auth(c, async () => {
        await secure(c, next);
      });
    } catch (e) {
      c.status(401);
      return c.json({ error: 'Unauthorized' });
    }
  };
};