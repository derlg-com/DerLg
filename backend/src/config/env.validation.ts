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
  // Number of reverse proxies in front of the app. 0 = direct exposure.
  // Required for correct client-IP resolution, which rate limiting keys on.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),
  // 32 chars minimum. A short HS256 secret is brute-forceable offline from a
  // single captured token, and forging one yields an arbitrary `sub` — i.e.
  // full impersonation of any user or admin. `min(1)` accepted "x".
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // ---------------------------------------------------------------------------
  // Stripe — card payments
  // ---------------------------------------------------------------------------
  // Empty disables card payments: the endpoints answer 503 rather than the app
  // refusing to boot, so the catalogue and ABA still work without Stripe.
  STRIPE_SECRET_KEY: z
    .string()
    .default('')
    .refine((v) => v === '' || v.startsWith('sk_'), {
      message:
        'STRIPE_SECRET_KEY must start with "sk_" (you may have pasted a publishable key)',
    }),
  // From `stripe listen` in dev, or the endpoint's signing secret in the
  // dashboard. Without it, webhook signatures cannot be verified and the webhook
  // fails closed — an unverified webhook is an open "mark this booking paid"
  // endpoint, so there is no safe fallback.
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .default('')
    .refine((v) => v === '' || v.startsWith('whsec_'), {
      message: 'STRIPE_WEBHOOK_SECRET must start with "whsec_"',
    }),

  // ---------------------------------------------------------------------------
  // ABA Bank — dynamic KHQR, confirmed from a Telegram credit alert
  // ---------------------------------------------------------------------------
  // The merchant's STATIC KHQR string from ABA onboarding. Not a secret (it is
  // encoded into every QR shown to a customer), but it is the merchant
  // identifier, so a wrong value sends money to someone else's account.
  //
  // Validated for the EMVCo prefix `000201` and a plausible length so a
  // truncated paste fails at boot instead of producing QR codes nobody can scan.
  ABA_STATIC_QR: z
    .string()
    .default('')
    .refine((v) => v === '' || (v.startsWith('000201') && v.length >= 30), {
      message:
        'ABA_STATIC_QR must be a full KHQR string starting with "000201" (check for a truncated paste)',
    }),
  // Minutes a generated QR stays payable. ABA rejects a dynamic QR whose tag-99
  // expiry has passed, and the booking hold is 15 minutes, so this must stay
  // under that or a customer can pay for a hold that has already been released.
  ABA_QR_TTL_MINUTES: z.coerce.number().int().min(1).max(14).default(10),
  // Telegram group where ABA's bot posts credit alerts, in "marked" form
  // (-100...). Alerts from any other chat are ignored.
  ABA_TELEGRAM_GROUP_ID: z.string().default(''),
  // Comma-separated Telegram user ids allowed to settle a payment.
  //
  // Group membership alone is NOT sufficient authorisation: anyone who can post
  // in the group could send text matching the alert format and settle an unpaid
  // booking. Leave empty only if the group is provably locked down to ABA's bot.
  ABA_ALERT_SENDER_IDS: z.string().default(''),

  // ---------------------------------------------------------------------------
  // Telegram MTProto (GramJS) — the userbot that reads ABA's alerts
  // ---------------------------------------------------------------------------
  // A user account, not a bot: the Bot API forbids one bot from reading another
  // bot's messages, so a Bot API listener would never see an ABA alert.
  // api_id / api_hash come from https://my.telegram.org.
  TELEGRAM_API_ID: z.coerce.number().int().default(0),
  TELEGRAM_API_HASH: z.string().default(''),
  // Generated once by `npm run telegram:login`. This is a full credential for
  // the Telegram account — treat it exactly like a password and never commit it.
  TELEGRAM_SESSION: z.string().default(''),

  // Optional so the API can boot without the AI agent, but if present it must be
  // strong: it is the only credential guarding /v1/ai-tools/*.
  AI_SERVICE_KEY: z
    .string()
    .default('')
    .refine((v) => v === '' || v.length >= 32, {
      message: 'AI_SERVICE_KEY must be at least 32 characters when set',
    }),
  RESEND_API_KEY: z.string().default(''),
  FCM_SERVER_KEY: z.string().default(''),
  EXCHANGE_RATE_API_KEY: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default(''),
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
