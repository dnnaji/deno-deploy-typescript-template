import { z } from 'npm:zod';

const toggle = z.enum(['true', 'false', '1', '0']).transform((v) =>
  v === 'true' || v === '1'
);

export const env = z
  .object({
    PORT: z.coerce.number().default(8000),
    API_TOKEN: z.string().min(1, 'API token is required'),
    AWS_SES_ACCESS_KEY_ID: z.string().min(1),
    AWS_SES_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_SES_REGION: z.string().default('us-east-1'),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    DISABLE_CRON: toggle.default('false'),
  })
  .strict()
  .parse(Deno.env.toObject());

export type Env = typeof env;