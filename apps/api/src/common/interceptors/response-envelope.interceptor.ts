import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';

import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import {
  ApiSuccessResponse,
  isPaginated,
} from '../interfaces/api-response.interface';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

/** Marks a handler as returning a raw response (SSE, file downloads, webhooks). */
export const RAW_RESPONSE_KEY = 'derlg:raw-response';

/**
 * Wraps every handler result in the project-wide envelope:
 *   { success, data, message, meta?, requestId }
 * Handlers returning `Paginated<T>` are unwrapped into `data` + `meta`.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) {
      return next.handle();
    }

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'OK';

    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.header(REQUEST_ID_HEADER) ?? undefined;

    return next.handle().pipe(
      map((payload: unknown): ApiSuccessResponse<unknown> => {
        if (isPaginated(payload)) {
          return {
            success: true,
            data: payload.items,
            message,
            meta: payload.meta,
            requestId,
          };
        }

        return {
          success: true,
          data: payload ?? null,
          message,
          requestId,
        };
      }),
    );
  }
}
