# Architecture & Technical Decisions

## 1. Runtime Goals
- **Fast cold-start**: Aim for <50ms on Deno Deploy. Achieved via minimal dependencies, Hono framework, native Deno features (`Deno.cron`), and V8 snapshotting.
- **Fail-fast validation**: Zod used for environment variable validation (`env.ts`) and potentially for request input validation within route handlers. Ensures configuration and basic input errors are caught early.
- **API Versioning**: Use URL prefix (`/v1`) for clear version separation and future evolution.

## 2. Folder Structure
| Folder              | Purpose                             | Responsibilities & Key Patterns                                                                                                                                        |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connectors`        | Stateless external API clients      | Handle raw HTTP calls, authentication with external services, basic response parsing. Use `neverthrow` for `Result` types. Implement retry logic (`@std/async/retry`). |
| `services`          | Business logic orchestration        | Combine data from connectors, enforce domain rules, handle complex workflows. Return `Result` types.                                                                   |
| `routes/v1`         | Versioned API route handlers        | Define HTTP endpoints, parse/validate request inputs (e.g., using Zod manually), call services, format responses.                                                      |
| `routes/jobs`       | HTTP endpoints for job triggers     | Define `/jobs/trigger/<name>` endpoints. Logic **must be idempotent**. Protected by auth middleware.                                                                   |
| `jobs`              | Scheduled task definitions & runner | Contains `Deno.cron` setup (`process-scheduled-jobs.ts`) and potentially specific job logic files (like `daily-report.ts` if not purely service calls).                |
| `middleware`        | Hono request pipeline handlers      | Auth, CORS, Rate Limiting, Global Error Handling, Request Logging, Secure Headers.                                                                                     |
| `utils`             | Shared, stateless utilities         | Logging (`@std/log`), Cron Scheduling (`job-schedule.ts`), Non-blocking Fetch (`fire-and-forget.ts`), potentially Redis client wrapper, constants.                     |
| `types`             | Shared TypeScript types & errors    | Domain models, API request/response shapes, custom `AppError` subclasses.                                                                                              |
| `specs`             | Documentation                       | This file (`SPECS.md`). (OpenAPI spec removed).                                                                                                                        |
| `.github/workflows` | CI/CD pipelines                     | Linting, formatting, testing, deployment via `deployctl`.                                                                                                              |

## 3. Job Orchestration

### 3.1 Job Registry (Redis metadata)
*   **Storage**: Job definitions are stored in Redis (Upstash recommended for Deno Deploy).
*   **Key pattern**: `jobs:meta:<name>` (e.g., `jobs:meta:daily-report`).
*   **Payload** (JSON stored as a string):
    ```jsonc
    {
      "route": "/jobs/trigger/<name>",   // Absolute Hono route to invoke
      "schedule": "*/5 * * * *",         // Cron expression (server TZ)
      "method": "POST",                  // HTTP verb (usually POST)
      "body": { /* optional */ },        // Optional JSON request body for POST
      "headers": { /* optional */ },     // Optional custom headers for the trigger request
      "lastRun": 0,                      // Epoch ms; updated atomically after triggering
      "timeoutSeconds": 10             // Optional: Max fetch duration (seconds) for the trigger request
    }
    ```
*   **Rationale**: Uses Redis as a lightweight, persistent, highly available metadata store. Leverages fast atomic operations (`GET`, `HSET`/`SET`) suitable for edge environments where application instances are ephemeral.

### 3.2 HTTP‑triggered jobs
*   **Execution**: All concrete job work is executed via standard HTTPS endpoints following the pattern `/jobs/trigger/<name>`.
*   **Location**: These routes live in `routes/jobs/trigger-routes.ts` and are part of the main Hono application.
*   **Rationale**: Reuses existing infrastructure (router, middleware stack), making jobs testable via `curl`, debuggable using browser dev tools, and manually triggerable if needed. Decouples the scheduling mechanism from the execution logic.
*   **Idempotency**: **Crucially, the logic within each `/jobs/trigger/<name>` endpoint *must* be designed to be idempotent.** While the scheduler aims for exactly-once triggering based on `lastRun`, edge cases (scheduler restarts, network issues during trigger) could lead to duplicate calls. The distributed lock protects the *scheduler loop* (§4), not the guarantee of single job execution.
*   **Security**: These endpoints **must** be protected by the standard application authentication/authorization middleware (configured in `main.ts`), even though they are typically called internally by the scheduler loop.

### 3.3 Scheduler loop (`jobs/process-scheduled-jobs.ts`)
*   **Trigger**: A `Deno.cron` job runs every minute (`*/1 * * * *`) to check for due jobs.
*   **Locking**: It first attempts to acquire a distributed lock (`lock:cron:psj`) using `@upstash/lock` (see §4) to ensure only one instance of the scheduler runs globally at any time.
*   **Execution Flow (if lock acquired)**:
    1.  Scans for job metadata keys in Redis (`redis.keys('jobs:meta:*')`). *Note: Consider using a Redis SET (`jobs:registry`) containing job names for better scalability if the number of jobs becomes very large (thousands).*
    2.  Iterates through each job key.
    3.  Fetches and parses the job metadata JSON.
    4.  Checks if the job is due using `utils/job-schedule.ts::isDue()`, comparing `schedule`, `lastRun`, and the current time.
    5.  If due, triggers the job's HTTP endpoint via `utils/fire-and-forget.ts`. This performs a non-blocking `fetch` call with `keepalive: true` and a configurable timeout based on `timeoutSeconds` from the metadata.
    6.  Updates the job's `lastRun` timestamp in Redis *after* successfully initiating the trigger `fetch`.
    7.  Uses `Promise.allSettled` and includes `try/catch` around individual job processing to prevent one failing job (e.g., bad metadata JSON) from stopping the entire loop. Errors are logged.
*   **Observability**: Logs key actions: loop start/end, lock acquisition success/failure, number of jobs found, checking/triggering individual jobs, and any errors encountered during processing.

### 3.4 New helper modules for Jobs

| file                       | responsibility                                                         | Dependencies      |
| -------------------------- | ---------------------------------------------------------------------- | ----------------- |
| `utils/job-schedule.ts`    | `isDue(schedule: string, lastRun: number, now: number): boolean`       | `npm:cron-parser` |
| `utils/fire-and-forget.ts` | Non-blocking `fetch` wrapper with `keepalive` and configurable timeout | `fetch` (native)  |

## 4. Distributed Lock for Cron
*   **Purpose**: To ensure that the `processScheduledJobs` cron loop runs on only one application instance at a time, preventing duplicate job triggers caused by multiple schedulers running concurrently.
*   **Strategy**: Upstash single‑key lock (`SET key value NX PX ttl`) implemented via the `@upstash/lock` library.
*   **Key**: `lock:<critical-section>` (specifically `lock:cron:psj` for the scheduler loop).
*   **TTL (Time To Live)**: `ttl = schedulerLoopMaxDuration + safetyMargin`. The TTL guards the *scheduler loop execution itself*, preventing concurrent runs if an instance crashes mid-loop without releasing the lock. It should be longer than the loop's expected maximum runtime (which should be very short, likely << 1 minute) plus a safety buffer. E.g., **90 seconds** is a reasonable default for a 60-second loop cadence. This TTL is *not* related to the duration of the individual jobs being triggered.
*   **Rationale**: Chosen for low latency when used with edge functions (like Deno Deploy), compatibility with HTTP-only Redis clients (like Upstash REST API), and simplicity for single-instance scheduler protection. If stronger multi-node consistency guarantees were needed (e.g., across multiple independent Redis nodes), an algorithm like Redlock might be considered, but it adds complexity.
*   **Observability**: The scheduler logs a debug message if it fails to acquire the lock, indicating that another instance is likely already running the loop.

## 5. Patterns & Middleware
*   **Error Handling**:
    *   Use `neverthrow` (`Result`, `ResultAsync`) for explicit, typed error handling in services and connectors where operations can fail predictably (e.g., API calls, database operations).
    *   A global error handling middleware (`middleware/error-handler.ts`) catches any unhandled exceptions that bubble up. It logs the full error details (including stack trace and correlation ID) and returns a generic, non-revealing 500 error response to the client.
*   **Config & Env**:
    *   Environment variables are validated at startup using Zod in `env.ts`. Access fails immediately if required variables are missing or invalid.
    *   A derived `config.ts` provides runtime configuration (like `isProd`, `logLevel`, service URLs, feature flags) based on the validated environment variables.
    *   Prefer direct module imports for dependencies (config, services, utils) over a complex Dependency Injection container or global AppContext, leveraging Deno Deploy's module caching and warm instances.
*   **Logging**:
    *   Uses `@std/log` configured in `utils/log.ts` via `setupLogger`.
    *   Outputs structured JSON logs to the console.
    *   A middleware injects a unique `correlationId` into the Hono context (`c.set('correlationId', ...)`) for each request. Log calls should include this ID for request tracing.
*   **Authentication**: `hono/bearer-auth` middleware (`middleware/auth.ts`) protects most routes in production. Bypassed for `/health` endpoint and during local development (`cfg.isDev`).
*   **CORS**: `hono/cors` middleware configured in `main.ts`. Origins should be strictly configured for production environments.
*   **Rate Limiting**: Basic in-memory rate limiter (`middleware/rate-limiter.ts`) provided as a placeholder. **CRITICAL**: This **must** be replaced with a distributed solution (using Deno KV or Redis/Upstash) for production Deno Deploy environments to be effective across multiple instances.
*   **Retry Logic**: `@std/async/retry` used within connectors (`connectors/aws-ses-connector.ts`) to handle transient network errors when calling external APIs. Uses exponential backoff.

## 6. Security
*   **Authentication**: Bearer token required for most API access in production. Ensure tokens are securely generated, stored, and rotated.
*   **Authorization**: Implement specific authorization checks within route handlers or services if different users/roles have varying permissions (not included in base template).
*   **Headers**: `hono/secure-headers` middleware applies security-related HTTP headers (like HSTS, X-Frame-Options, etc.) to mitigate common web vulnerabilities.
*   **Input Validation**: Use Zod (or similar) within route handlers to validate request bodies, query parameters, and path parameters against expected schemas. Reject invalid requests early.
*   **Secrets Management**: Store sensitive credentials (API keys, tokens) as environment variables configured securely within the Deno Deploy dashboard. Do not commit secrets to version control (`.env` file is for local development only and should be in `.gitignore`).
*   **Rate Limiting**: Protects against brute-force attacks and denial-of-service (requires distributed implementation for production).
*   **CORS**: Restrict allowed origins in production to prevent cross-site request forgery from unintended domains.

## 7. Observability
*   **Logging**: Structured JSON logs with levels (DEBUG, INFO, WARN, ERROR) and correlation IDs enable effective filtering and analysis in log aggregation platforms.
*   **Health Check**: A simple `/health` endpoint provides a basic liveness check for load balancers or monitoring systems.
*   **Metrics**: **Next Step**: Implement a `/metrics` endpoint compatible with Prometheus scraping (e.g., using `hono/prometheus` or a similar library) to expose application-level metrics (request counts, durations, error rates, job counts).
*   **Tracing**: While not included, consider integrating distributed tracing (e.g., OpenTelemetry) for more complex microservice architectures or detailed performance analysis across external calls.

## 8. Testing Strategy
*   **Unit Tests (`deno test`)**:
    *   Focus on testing individual functions and modules in isolation.
    *   Test utility functions (`utils/`), service logic (`services/`), and complex data transformations.
    *   Use mocking/stubbing for external dependencies (connectors, Redis client).
    *   Example: `jobs/process-scheduled-jobs.test.ts` mocks Redis and `fireAndForget` to verify scheduler logic. `utils/job-schedule.test.ts` tests `isDue` logic.
*   **Integration Tests (`deno test` with `--allow-net` etc.)**:
    *   Test the interaction between components, typically at the route level.
    *   Use tools like `supertest` (or Hono's built-in test client) to make HTTP requests to the application instance.
    *   Mock external API calls at the connector level to avoid hitting real services during tests.
    *   Example: Test the `/v1/alert/email` route by mocking the `aws-ses-connector` and asserting the correct response and status code.
*   **Lock Testing**: Inject a mock Upstash client or Redis instance into tests for `process-scheduled-jobs.ts`. Simulate lock acquisition failure and assert the main processing logic is skipped. Test successful lock acquisition and release.

## 9. CI/CD
*   **Workflow**: Uses GitHub Actions (`.github/workflows/deploy.yml`).
*   **Triggers**: Runs on pushes to the `main` branch.
*   **Steps**:
    1.  Checks out code.
    2.  Sets up Deno.
    3.  Runs code formatting check (`deno task fmt --check`).
    4.  Runs linter (`deno task lint`).
    5.  (Optional but Recommended) Runs tests (`deno task test`).
    6.  Deploys the application to Deno Deploy using `deployctl`.
*   **Secrets**: Requires `DENO_PROJECT` secret to be configured in the GitHub repository settings, containing the name of the linked Deno Deploy project. `deployctl` uses OIDC for authentication with Deno Deploy.

