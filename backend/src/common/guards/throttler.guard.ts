import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorCode } from '../errors/error-codes';

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
