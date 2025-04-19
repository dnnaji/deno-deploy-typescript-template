import { Hono } from '@hono/hono';
import { z } from 'zod';
import { sendEmail } from '@/services/alert-service.ts';
import { getChildLogger } from '@/utils/log.ts';

const logger = getChildLogger('alert-routes');
const alertRouter = new Hono();

// --- Schemas (No .openapi()) ---
const EmailRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
});

// --- Route Handler (Standard Hono) ---
alertRouter.post('/alert/email', async (c) => {
  const correlationId = c.get('correlationId');
  logger.info('Received POST /alert/email request', correlationId);

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    logger.warn('Failed to parse request body', correlationId, e);
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsedBody = EmailRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    logger.warn('Invalid request body schema', correlationId, parsedBody.error);
    return c.json({
      error: 'Invalid input',
      details: parsedBody.error.flatten(),
    }, 400);
  }

  const result = await sendEmail(parsedBody.data).match(
    (successMsg) => {
      logger.info('Email sent successfully', correlationId);
      return { ok: true, message: successMsg };
    },
    (error) => {
      logger.error('Failed to send email', correlationId, error);
      return { ok: false, error: error.message };
    },
  );

  const status = result.ok ? 200 : 500; // Or map specific errors to 4xx/5xx
  return c.json(result, status);
});

export default alertRouter;
