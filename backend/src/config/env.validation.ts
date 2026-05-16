import { z } from 'zod';

/**
 * Validates all environment variables at startup.
 * Missing required vars cause immediate process exit with code 1.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CORS_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  AI_SERVICE_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  FCM_SERVER_KEY: z.string().default(''),
  EXCHANGE_RATE_API_KEY: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;
