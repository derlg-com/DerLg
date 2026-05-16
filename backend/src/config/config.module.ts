import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env.validation';

/**
 * Loads and validates environment variables at startup using Zod.
 * Missing required vars cause immediate process exit with code 1.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          const formatted = parsed.error.format();
          const errors = Object.entries(formatted)
            .filter(([key]) => key !== '_errors')
            .map(([key, value]) => {
              const errs = (value as { _errors?: string[] })._errors;
              return errs?.length ? `  ${key}: ${errs.join(', ')}` : null;
            })
            .filter(Boolean);
          throw new Error(
            `Environment validation failed:\n${errors.join('\n')}`,
          );
        }
        return parsed.data;
      },
    }),
  ],
})
export class ConfigModule {}
