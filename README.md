# Deno Hono Serverless Template

A starter template for building serverless APIs on Deno Deploy using Hono.

## Features

- **Hono Framework**: Fast and lightweight web framework.
- **TypeScript**: Strong typing.
- **Deno Deploy Ready**: Optimized for serverless deployment.
- **Zod**: Environment and input validation.
- **Neverthrow**: Robust error handling with Result types.
- **Structured Logging**: JSON logs with correlation IDs via `@std/log`.
- **API Versioning**: Routes organized under `/v1`.
- **Middleware**: Includes Auth, CORS, Rate Limiting (basic), Secure Headers,
  Error Handling.
- **Connectors**: Example AWS SES connector with retry logic.
- **Jobs**: Centralized scheduled job management using Redis and HTTP endpoints.
- **CI/CD**: Basic GitHub Actions workflow for linting, testing, and deployment.

## Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd deno-hono-template
   ```
2. **Install Deno:** Follow instructions at
   [https://deno.land/manual/getting_started/installation](https://deno.land/manual/getting_started/installation)
3. **Environment Variables:**
   - Create a `.env` file in the root directory for local development.
   - Copy the keys from `env.ts` and provide values. Example:
     ```env
     PORT=8000
     API_TOKEN="your-secret-api-token"
     AWS_SES_ACCESS_KEY_ID="your-aws-key-id"
     AWS_SES_SECRET_ACCESS_KEY="your-aws-secret-key"
     # Optional: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
     # Optional: DISABLE_CRON=true
     ```
   - **Important**: Do NOT commit `.env` to version control. Add it to
     `.gitignore`.

## Development

- **Run the development server:**
  ```bash
  deno task dev
  ```
  This starts the server with hot-reloading on `http://localhost:8000`.

- **Linting:**
  ```bash
  deno task lint
  ```

- **Formatting:**
  ```bash
  deno task fmt
  ```

- **Testing:**
  ```bash
  deno task test
  ```

## Deployment (Deno Deploy)

1. **Link Project:** Use `deployctl` or the Deno Deploy dashboard to link your
   GitHub repository to a Deno Deploy project.
   ```bash
   deployctl link --project=<your-deno-project-name>
   ```
2. **Configure Environment Variables:** Add the required environment variables
   (from `env.ts`) to your Deno Deploy project settings.
3. **Push to `main` branch:** The GitHub Actions workflow in
   `.github/workflows/deploy.yml` will automatically build and deploy the
   application.

## Project Structure

(See `specs/SPECS.md` for detailed explanations)

```
deno-hono-template/
├─ .github/workflows/      # CI/CD
├─ connectors/             # External API clients
├─ jobs/                   # Scheduled tasks
├─ middleware/             # Hono middleware
├─ routes/v1/              # API v1 routes
├─ services/               # Business logic
├─ specs/                  # Documentation (Tech Specs)
├─ types/                  # Shared TypeScript types/errors
├─ utils/                  # Shared utilities (logging, etc.)
├─ config.ts               # Application configuration derived from env
├─ env.ts                  # Environment variable validation (Zod)
├─ main.ts                 # Application entry point
├─ deno.jsonc              # Deno configuration (tasks, imports)
└─ README.md               # This file
```