import type { Context, Next } from '@hono/hono'; // Use type import if only types are needed
import { getChildLogger } from '@/utils/log.ts';

const logger = getChildLogger('rate-limiter');

// WARNING: In-memory store is NOT suitable for production Deno Deploy.
// Use Redis or Deno KV for distributed rate limiting.
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // Max requests per window per IP

export const simpleRateLimiter = async (c: Context, next: Next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown-ip';
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (record && now < record.resetTime) {
    if (record.count >= MAX_REQUESTS) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`, c.get('correlationId'));
      c.status(429); // Too Many Requests
      return c.json({ error: 'Rate limit exceeded' });
    }
    record.count++;
  } else {
    // Start new window
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
  }

  // Clean up old entries periodically (simple approach)
  if (Math.random() < 0.01) { // 1% chance on any request
    for (const [keyIp, rec] of requestCounts.entries()) {
      if (now > rec.resetTime) {
        requestCounts.delete(keyIp);
      }
    }
  }

  await next();
};