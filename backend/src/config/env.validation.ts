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
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  // When 'true', enables the sandbox booking-confirm endpoint that marks a
  // booking paid WITHOUT a real charge. Must never be 'true' in production.
  DEMO_PAYMENTS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // ---------------------------------------------------------------------------
  // MinIO — object storage for admin media (self-hosted Docker, not a cloud SaaS)
  // ---------------------------------------------------------------------------
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
  MINIO_ACCESS_KEY: z.string().default(''),
  MINIO_SECRET_KEY: z.string().default(''),
  MINIO_BUCKET: z.string().default('derlg-storage'),

  // ---------------------------------------------------------------------------
  // Telegram driver bot
  // ---------------------------------------------------------------------------
  // Feature-flagged off by default so a missing token cannot stop the public API
  // from booting. When false, the bot endpoints report themselves disabled.
  TELEGRAM_BOT_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_WEBHOOK_URL: z.string().default(''),
  // Verified against Telegram's X-Telegram-Bot-Api-Secret-Token header.
  TELEGRAM_SECRET_TOKEN: z.string().default(''),
  TELEGRAM_LOCATION_TRACKING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TELEGRAM_BROADCAST_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;
