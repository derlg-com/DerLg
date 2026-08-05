import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from 'nestjs-pino';
import { Request, Response } from 'express';

/**
 * Logs every HTTP request as a single, color-coded line via Pino.
 * The log LEVEL is chosen from the response status so failures stand out:
 *   - 5xx → error (red)
 *   - 4xx → warn  (yellow)
 *   - else → info (green)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = (request.headers['x-request-id'] as string) || 'unknown';
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.write(response.statusCode, method, url, requestId, start),
        error: (err: { status?: number }) =>
          this.write(
            err?.status ?? response.statusCode ?? 500,
            method,
            url,
            requestId,
            start,
          ),
      }),
    );
  }

  private write(
    status: number,
    method: string,
    url: string,
    requestId: string,
    start: number,
  ): void {
    const message = `${method} ${url} → ${status} (${Date.now() - start}ms) [${requestId}]`;
    if (status >= 500) this.logger.error(message);
    else if (status >= 400) this.logger.warn(message);
    else this.logger.log(message);
  }
}
