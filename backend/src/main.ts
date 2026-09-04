import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaFilter } from './common/filters/prisma.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Bootstraps the NestJS application with global pipes, filters,
 * interceptors, security headers, CORS, and the /v1 route prefix.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Keeps the unparsed body on `request.rawBody`.
    //
    // Stripe signs webhook payloads over the exact bytes it sent, so verification
    // must see those bytes. A body that has been through JSON.parse and
    // re-serialised will not match — key order and whitespace are enough to break
    // it — and the only alternative to verifying is trusting an unauthenticated
    // "mark this booking paid" request.
    //
    // Applies to every route but is only read by the Stripe webhook controller.
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // Behind a reverse proxy (Coolify/nginx) `req.ip` is the proxy's address
  // unless Express is told to trust the forwarded headers. Every client would
  // otherwise share one rate-limit bucket, and the limiter would lock out all
  // users the moment one of them was noisy.
  //
  // Set to the number of proxies in front of the app, not `true`: trusting the
  // whole chain lets a client spoof `X-Forwarded-For` and mint a fresh bucket
  // per request, which defeats rate limiting entirely.
  const trustProxy = configService.get<number>('TRUST_PROXY_HOPS');
  if (trustProxy && trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  }

  // Prisma maps `bigint` columns to JavaScript BigInt, and `JSON.stringify`
  // throws `TypeError: Do not know how to serialize a BigInt` rather than
  // skipping the value. `drivers.telegram_id` is such a column, so
  // GET /v1/admin/drivers returned a 500 as soon as any driver had linked their
  // Telegram account — the exact rows the fleet page exists to show.
  //
  // Express's `json replacer` hook is used rather than patching
  // `BigInt.prototype.toJSON`: it is scoped to this app's responses instead of
  // mutating a global built-in, and it runs inside the existing stringify pass
  // rather than deep-walking every payload again.
  //
  // Serialized as a string, not a number: Telegram ids exceed
  // Number.MAX_SAFE_INTEGER, so a JSON number would silently lose precision.
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new PrismaFilter(), new AllExceptionsFilter());

  app.useGlobalInterceptors(new LoggingInterceptor(app.get(Logger)));

  app.use(cookieParser());

  app.use(
    helmet({
      // This process serves JSON only — no HTML, no inline scripts — so a
      // restrictive policy costs nothing and still blunts content-sniffing and
      // framing attacks against error pages or any future static response.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // An empty allowlist blocks every browser client, which in production looks
  // like "the whole site is broken" with no clue why. Fail at boot instead.
  if (isProd && corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must list at least one origin in production ' +
        '(comma-separated, e.g. https://derlg.com,https://admin.derlg.com).',
    );
  }
  if (corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ORIGINS must not contain "*": credentials are enabled, and a ' +
        'wildcard origin with credentials lets any site read authenticated ' +
        'responses. List the exact origins instead.',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    // Needed so the admin panel and web app can send the service/idempotency
    // headers they already set; omitting them triggers a preflight failure.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'Retry-After',
    ],
  });

  // Support unprefixed OAuth callback redirects from identity providers (e.g. Google redirecting to /auth/google/callback)
  app.use((req: { path?: string; url: string }, _res: unknown, next: () => void) => {
    if (req.path === '/auth/google/callback' || req.url.startsWith('/auth/google/callback')) {
      req.url = '/v1/auth/google/callback' + req.url.slice('/auth/google/callback'.length);
    } else if (req.path === '/auth/google' || req.url.startsWith('/auth/google')) {
      req.url = '/v1/auth/google' + req.url.slice('/auth/google'.length);
    }
    next();
  });

  app.setGlobalPrefix('v1');

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
