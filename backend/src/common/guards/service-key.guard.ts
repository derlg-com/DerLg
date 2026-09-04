import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Authenticates service-to-service callers (the Vibe Booking AI agent) via the
 * `X-Service-Key` header.
 *
 * This is the only thing standing between the public internet and
 * `/v1/ai-tools/*`, which can create booking holds and read any user's loyalty
 * balance — so it fails closed and compares in constant time.
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  private readonly logger = new Logger(ServiceKeyGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();

    const provided = request.headers['x-service-key'];
    const expected = this.configService.get<string>('AI_SERVICE_KEY');

    if (!expected) {
      // An unset key must never mean "allow anyone". Logged as an error because
      // it is a deployment fault, not a client fault.
      this.logger.error(
        'AI_SERVICE_KEY is not configured; rejecting all service-key requests',
      );
      throw new UnauthorizedException('Invalid service key');
    }

    if (!provided || !this.matches(provided, expected)) {
      throw new UnauthorizedException('Invalid service key');
    }

    return true;
  }

  /**
   * Constant-time comparison.
   *
   * `a !== b` returns as soon as it finds a differing byte, so response latency
   * leaks how many leading characters were correct — enough to recover a secret
   * one character at a time. Hashing first gives both sides a fixed 32-byte
   * length, which also avoids `timingSafeEqual` throwing on length mismatch
   * (itself a length oracle).
   */
  private matches(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
  }
}
