import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Fail-fast environment validation. The app refuses to boot when a required
 * variable is missing or malformed, so misconfiguration never surfaces as a
 * confusing runtime error deep inside a request.
 *
 * Numeric variables carry an explicit `@Type(() => Number)` because process env
 * values are always strings and implicit conversion cannot be relied upon
 * across ts-jest / nest build / tsx.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3101;

  @IsString()
  @MinLength(1)
  CORS_ORIGINS = 'http://localhost:3100';

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1)
  REDIS_URL!: string;

  // ---- Auth ----
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @MinLength(2)
  JWT_ACCESS_TTL = '15m';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  /** Domain for the refresh cookie; omit in dev so localhost works. */
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  // ---- Stripe ----
  // All three are optional so the app boots without payment credentials; the
  // payment endpoints then return a clear 503 rather than crashing at startup.
  @IsOptional()
  @IsString()
  @MinLength(10)
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  STRIPE_PUBLISHABLE_KEY?: string;

  // ---- LLM (OpenAI-compatible; NVIDIA NIM by default) ----
  // Optional so the app boots without AI credentials; the Vibe endpoints then
  // answer 503 rather than the process failing at startup.
  @IsString()
  OPENAI_BASE_URL = 'https://integrate.api.nvidia.com/v1';

  @IsOptional()
  @IsString()
  @MinLength(10)
  OPENAI_API_KEY?: string;

  @IsString()
  @MinLength(1)
  OPENAI_MODEL = 'meta/llama-3.1-8b-instruct';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(300_000)
  OPENAI_TIMEOUT_MS = 60_000;

  // ---- R2 (Cloudflare object storage) ----
  // Optional so the app boots without storage credentials; image endpoints
  // and the seed uploader then return 503 rather than the process failing.
  @IsOptional()
  @IsString()
  R2_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  R2_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  R2_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  R2_BUCKET?: string;

  @IsOptional()
  @IsString()
  R2_PUBLIC_BASE_URL?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // A variable present but empty (`STRIPE_SECRET_KEY=`) means "not configured",
  // so it is normalised to undefined before validation — otherwise @IsOptional
  // would not apply and the empty string would fail length checks.
  const normalised = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value === '' ? undefined : value]),
  );

  const config = plainToInstance(EnvironmentVariables, normalised, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }

  return config;
}
