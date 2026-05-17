import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorCode } from '../errors/error-codes';

/**
 * Returns `RATE_LIMIT_EXCEEDED` instead of the default throttler message.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = ErrorCode.RATE_LIMIT_EXCEEDED;

  getErrorResponse(): { statusCode: number; message: string } {
    return {
      statusCode: 429,
      message: ErrorCode.RATE_LIMIT_EXCEEDED,
    };
  }
}
