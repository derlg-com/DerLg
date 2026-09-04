import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

import type { Request } from 'express';

/**
 * Verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
 *
 * This header is the only thing authenticating the webhook: the endpoint is
 * public, and anything that reaches it can drive driver state — flipping drivers
 * online, accepting trip assignments, or posting locations.
 *
 * Three problems in the previous version are fixed here:
 *
 *  1. It **failed open**. `if (!this.secret) return true` meant an unset secret
 *     turned the webhook into an unauthenticated write endpoint. It now fails
 *     closed.
 *  2. It read `TELEGRAM_BOT_SECRET`, which is not a variable this project
 *     defines — the configured name is `TELEGRAM_SECRET_TOKEN`. So the secret was
 *     always empty, which combined with (1) meant the guard never rejected
 *     anything.
 *  3. It compared with `!==`, which short-circuits on the first differing byte
 *     and leaks the secret's prefix to a timing attack.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSecretGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const enabled = this.configService.get<boolean>('TELEGRAM_BOT_ENABLED');
    const secret =
      this.configService.get<string>('TELEGRAM_SECRET_TOKEN') ?? '';

    // Bot switched off: reject rather than process an update nobody configured.
    if (!enabled) {
      throw new ServiceUnavailableException('Telegram bot is disabled');
    }

    // Enabled but unconfigured is a deployment error, not a reason to trust the
    // caller.
    if (secret === '') {
      this.logger.error(
        'TELEGRAM_BOT_ENABLED is true but TELEGRAM_SECRET_TOKEN is empty; rejecting webhook',
      );
      throw new ServiceUnavailableException(
        'Telegram webhook is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headerToken = request.headers['x-telegram-bot-api-secret-token'];

    if (typeof headerToken !== 'string' || headerToken.length === 0) {
      throw new UnauthorizedException('Missing webhook secret token');
    }

    if (!WebhookSecretGuard.safeEqual(headerToken, secret)) {
      this.logger.warn(
        'Rejected Telegram webhook with an invalid secret token',
      );
      throw new UnauthorizedException('Invalid webhook secret token');
    }

    return true;
  }

  /**
   * Constant-time string comparison.
   *
   * Lengths are compared first because `timingSafeEqual` throws on a mismatch;
   * that leak is acceptable since the secret's length is not the secret.
   */
  private static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
