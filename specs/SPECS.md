# Architecture & Technical Decisions

## 1. Runtime Goals

- **Fast cold-start**: Aim for <50ms on Deno Deploy. Achieved via minimal deps,
  Hono, native features.
- **Fail-fast validation**: Zod for env vars (`env.ts`) and route inputs (manual
  validation in handlers).
- **API Versioning**: Use URL prefix (`/v1`) for clear version separation.

## 2. Folder Structure

| Folder     | Purpose                        | Responsibilities                                               |
| ---------- | ------------------------------ | -------------------------------------------------------------- |
| connectors | Stateless API clients          | Handle external calls with retry/backoff (`@std/async/retry`). |
| services   | Business logic orchestration   | Use connectors; return `Result` types (`neverthrow`).          |
| routes/v1  | Versioned controllers          | Validate inputs (Zod manually); call services.                 |
| jobs       | Scheduled tasks                | Use `Deno.cron` with locks (implement lock separately).        |
| middleware | Request pipeline handlers      | Auth, CORS, Rate Limiting, Error Handling, Logging.            |
| utils      | Shared utilities               | Logging (`@std/log`), helpers.                                 |
| specs      | Documentation                  | Tech Specs (`SPECS.md`).                                       |
| types      | Shared TypeScript types/errors | Custom errors (`AppError`), shared interfaces.                 |

## 3. Patterns & Middleware

- **Error Handling**: `neverthrow` for explicit `Result` types. Global error
  middleware (`middleware/error-handler.ts`) catches unhandled exceptions.
- **Config & Env**: Zod in `env.ts`; `config.ts` for derived values. Direct
  imports.
- **Logging**: Wrapped `@std/log`, JSON output, correlation IDs set in
  middleware.
- **Authentication**: `hono/bearer-auth` in `middleware/auth.ts`, bypassed for
  health/dev.
- **CORS**: `hono/cors` middleware configured in `main.ts`.
- **Rate Limiting**: Simple in-memory limiter (`middleware/rate-limiter.ts`).
  **CRITICAL**: Replace with Redis/KV-based solution for production.
- **Retry Logic**: `@std/async/retry` used in connectors.

## 4. Security

- Bearer auth, `hono/secure-headers`, CORS, Rate Limiting.
- Manage secrets via Deno Deploy env vars.

## 5. Observability

- Structured JSON logs with correlation IDs.
- **Next Step**: Add a `/metrics` endpoint.

## 6. Extensibility

- Add new routes under `routes/v1/`.
- Add new connectors/services/middleware as needed.

## 7. CI/CD

- GitHub Actions workflow (`.github/workflows/deploy.yml`) lints, formats,
  (optionally tests), and deploys via `deployctl`. Requires `DENO_PROJECT`
  secret.
