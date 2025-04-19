// utils/fire-and-forget.ts
import { getChildLogger } from '@/utils/log.ts';

const logger = getChildLogger('fire-and-forget');
const DEFAULT_TIMEOUT_MS = 10 * 1000; // 10 seconds

interface JobMeta {
  route: string;
  method: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutSeconds?: number; // Optional timeout from job metadata
}

/**
 * Triggers an HTTP request without waiting for the response,
 * primarily for invoking job endpoints. Includes keepalive and a timeout.
 */
export function fireAndForget(meta: JobMeta, correlationId?: string) {
  const timeoutMs = meta.timeoutSeconds
    ? meta.timeoutSeconds * 1000
    : DEFAULT_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  const init: RequestInit = {
    method: meta.method,
    headers: {
      'Content-Type': 'application/json',
      ...(meta.headers || {}),
      // Optionally pass correlation ID if needed by the job endpoint
      ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
    },
    keepalive: true, // Important for fetch in background/unload contexts
    signal: abortController.signal,
  };

  if (meta.body && meta.method === 'POST') {
    try {
      init.body = JSON.stringify(meta.body);
    } catch (e) {
      logger.error(
        `Failed to stringify body for job ${meta.route}`,
        correlationId,
        e
      );
      clearTimeout(timeoutId); // Clean up timeout
      return; // Don't attempt fetch if body is invalid
    }
  }

  logger.info(`Triggering job: ${meta.method} ${meta.route}`, correlationId);

  fetch(meta.route, init)
    .then(async (response) => {
      // We don't wait, but we can log basic success/failure status
      if (!response.ok) {
        logger.warn(
          `Job ${meta.route} trigger returned status ${response.status}`,
          correlationId
        );
        // Optionally log response body for debugging non-2xx status
        // const text = await response.text().catch(() => '');
        // logger.debug(`Job ${meta.route} response body: ${text}`, correlationId);
      } else {
        logger.debug(`Job ${meta.route} trigger successful (status ${response.status})`, correlationId);
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        logger.warn(
          `Job ${meta.route} trigger fetch timed out after ${timeoutMs}ms`,
          correlationId
        );
      } else {
        // Log other fetch errors (network issues, DNS problems, etc.)
        logger.error(
          `Job ${meta.route} trigger fetch failed: ${err.message}`,
          correlationId,
          err
        );
      }
    })
    .finally(() => {
      clearTimeout(timeoutId); // Ensure timeout is cleared
    });
}