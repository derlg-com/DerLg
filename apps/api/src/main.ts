import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp, parseCorsOrigins } from './bootstrap/configure-app';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Stripe webhook signature verification needs the unparsed body.
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const corsOrigins = parseCorsOrigins(config.getOrThrow<string>('CORS_ORIGINS'));

  configureApp(app, corsOrigins);
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`DerLg API listening on http://localhost:${port}/v1`);
  logger.log(`CORS allowed origins: ${corsOrigins.join(', ')}`);
}

void bootstrap();
