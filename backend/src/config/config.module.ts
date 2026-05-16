import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        CORS_ORIGINS: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        DIRECT_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow(''),
        REDIS_DB: Joi.number().default(0),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        STRIPE_SECRET_KEY: Joi.string().allow(''),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow(''),
        AI_SERVICE_KEY: Joi.string().allow(''),
        RESEND_API_KEY: Joi.string().allow(''),
        FCM_SERVER_KEY: Joi.string().allow(''),
        EXCHANGE_RATE_API_KEY: Joi.string().allow(''),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
