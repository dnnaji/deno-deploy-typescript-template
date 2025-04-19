import { env } from 'env';

// Determine isProd/isDev first
const isProd = !!Deno.env.get('DENO_DEPLOYMENT_ID');
const isDev = !isProd;

export const cfg = {
  isProd,
  isDev,
  port: env.PORT,
  apiToken: env.API_TOKEN,
  logLevel: Deno.env.get('LOG_LEVEL') ?? (isProd ? 'INFO' : 'DEBUG'),
  cron: {
    enabled: !env.DISABLE_CRON,
    dailyReport: '0 7 * * *', // Daily at 7 AM
  },
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
  ses: {
    region: env.AWS_SES_REGION,
    accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
  },
} as const;