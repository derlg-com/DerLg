import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '../errors/error-codes';

/**
 * Catches any unhandled exception. Logs the full stack server-side
 * and returns a safe generic error to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string) || message;
        code = (obj.code as ErrorCode) || code;
      }
    }

    // Severity follows the status class. Logging a 429 or a 400 at ERROR with a
    // full stack floods the log exactly when it matters most: under a brute-force
    // or scraping run, every rejection the guard makes would emit a stack trace
    // and bury the genuine 5xx signal. Client errors are expected outcomes, so
    // they are recorded at WARN as a single line; only 5xx carries a stack.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${status} ${code}: ${message}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}
