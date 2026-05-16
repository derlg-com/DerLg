import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ErrorCode } from '../errors/error-codes';

/**
 * Maps Prisma database errors to standardized HTTP responses.
 * P2002 (unique constraint) → 409, P2025 (not found) → 404.
 */
@Catch(PrismaClientKnownRequestError)
export class PrismaFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002':
        response.status(409).json({
          success: false,
          error: {
            code: ErrorCode.DUPLICATE_ENTRY,
            message: 'This record already exists',
          },
        });
        break;
      case 'P2025':
        response.status(404).json({
          success: false,
          error: {
            code: ErrorCode.RECORD_NOT_FOUND,
            message: 'Record not found',
          },
        });
        break;
      case 'P2003':
        response.status(409).json({
          success: false,
          error: {
            code: ErrorCode.CONFLICT,
            message: 'Foreign key constraint failed',
          },
        });
        break;
      default:
        response.status(500).json({
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'An unexpected database error occurred',
          },
        });
    }
  }
}
