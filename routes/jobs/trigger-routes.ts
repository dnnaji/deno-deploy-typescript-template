// routes/jobs/trigger-routes.ts
import { Hono } from '@hono/hono';
// Import necessary services or logic for your jobs

const jobTriggerRouter = new Hono();

// Example Job Trigger Endpoint
jobTriggerRouter.post('/trigger/daily-report', async (c) => {
  const correlationId = c.req.header('X-Correlation-ID') || crypto.randomUUID();
  // IMPORTANT: This endpoint logic MUST be idempotent.
  // It might be called multiple times in rare failure scenarios.
  console.log(`[${correlationId}] Received trigger for daily-report job`);

  // --- Add your actual job logic here ---
  // Example: await runDailyReportService(correlationId);
  // ---

  console.log(`[${correlationId}] Finished daily-report job`);
  return c.json({ success: true, message: 'Daily report job triggered' });
});

// Add other job trigger endpoints here following the pattern /trigger/<job-name>

export default jobTriggerRouter;

// Remember to mount this router in main.ts under /jobs
// e.g., app.route('/jobs', jobTriggerRouter);
// Ensure this route is protected by your auth middleware in main.ts