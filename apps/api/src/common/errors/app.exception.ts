import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-codes';

/**
 * Domain exception carrying a stable ErrorCode plus optional structured
 * details. The global filter renders it into the standard error envelope.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
