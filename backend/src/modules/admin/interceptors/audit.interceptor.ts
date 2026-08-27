import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { PrismaService } from '../../prisma/prisma.service';

import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/** Body keys never written to the audit trail. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'authPin',
  'pin',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'clientSecret',
]);

/** URL path segment -> audited entity type. */
const ENTITY_TYPES: Record<string, string> = {
  drivers: 'DRIVER',
  vehicles: 'VEHICLE',
  maintenance: 'MAINTENANCE',
  assignments: 'ASSIGNMENT',
  bookings: 'BOOKING',
  hotels: 'HOTEL',
  guides: 'GUIDE',
  emergency: 'EMERGENCY',
  customers: 'CUSTOMER',
  loyalty: 'LOYALTY',
  discounts: 'DISCOUNT_CODE',
  'student-verifications': 'STUDENT_VERIFICATION',
  analytics: 'ANALYTICS',
  users: 'ADMIN_USER',
  'audit-logs': 'AUDIT_LOG',
  'ai-sessions': 'AI_SESSION',
  telegram: 'TELEGRAM',
  storage: 'STORAGE',
  upload: 'STORAGE',
  dashboard: 'DASHBOARD',
};

/**
 * The request shape this interceptor reads.
 *
 * `route` is `Omit`-ed off Express's `Request` before being re-declared: the
 * upstream types define it as `any`, and intersecting a property with `any`
 * leaves it `any`, so `request.route.path` stayed unchecked no matter what the
 * intersection said.
 */
type AuditableRequest = Omit<Request, 'route'> & {
  user?: JwtPayload;
  params: Record<string, string>;
  route?: { path?: string };
};

/**
 * Writes an `audit_logs` row for every admin mutation.
 *
 * Only POST/PATCH/PUT/DELETE are recorded; reads would swamp the table without
 * telling anyone anything. The write is deliberately fire-and-forget: an audit
 * failure must not turn a successful driver assignment into a 500. Failures are
 * logged with enough context to reconstruct what went unrecorded.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private static readonly MUTATING = new Set([
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditableRequest>();

    if (!AuditInterceptor.MUTATING.has(request.method)) {
      return next.handle();
    }

    // Captured before the handler runs: some handlers mutate req.body in place.
    const routePath = request.route?.path ?? request.originalUrl;
    const changedFields = this.redact(request.body);

    return next.handle().pipe(
      tap((response) => {
        void this.record(request, routePath, changedFields, response);
      }),
    );
  }

  private async record(
    request: AuditableRequest,
    routePath: string,
    changedFields: Record<string, unknown>,
    response: unknown,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: request.user?.sub ?? null,
          eventType: 'admin_action',
          entityType: this.inferEntityType(routePath),
          entityId: this.extractEntityId(request, response),
          ipAddress: request.ip ?? null,
          userAgent: request.headers['user-agent'] ?? null,
          metadata: {
            action: this.inferAction(request.method, routePath),
            method: request.method,
            path: routePath,
            changedFields,
          } as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      this.logger.warn('Audit log write failed', {
        method: request.method,
        path: routePath,
        userId: request.user?.sub,
        error: (error as Error).message,
      });
    }
  }

  /** Shallow copy of the request body with sensitive keys masked. */
  private redact(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      out[key] = REDACTED_KEYS.has(key) ? '[REDACTED]' : value;
    }
    return out;
  }

  private inferEntityType(routePath: string): string {
    // Route paths look like /v1/admin/drivers/:id — the resource is segment 3.
    const segments = routePath.split('/').filter(Boolean);
    const adminIdx = segments.indexOf('admin');
    const resource =
      adminIdx >= 0 ? segments[adminIdx + 1] : (segments[0] ?? 'UNKNOWN');
    return ENTITY_TYPES[resource] ?? (resource ?? 'UNKNOWN').toUpperCase();
  }

  private inferAction(method: string, routePath: string): string {
    const last = routePath.split('/').filter(Boolean).pop() ?? '';

    if (method === 'POST') {
      // Action-style POSTs are not creations.
      if (
        ['cancel', 'assign', 'acknowledge', 'resolve', 'adjust'].includes(last)
      ) {
        return last.toUpperCase();
      }
      return 'CREATE';
    }
    if (method === 'DELETE') return 'DELETE';
    if (method === 'PATCH' || method === 'PUT') {
      if (['deactivate', 'cancel', 'complete', 'assign'].includes(last)) {
        return last.toUpperCase();
      }
      return 'UPDATE';
    }
    return method;
  }

  /**
   * Resolves the affected row id.
   *
   * Reads `request.params` rather than scanning the URL for a UUID: `route.path`
   * contains placeholders like `:id`, never the value, so the previous regex over
   * the path could not match on any parameterised route.
   */
  private extractEntityId(
    request: AuditableRequest,
    response: unknown,
  ): string | null {
    const params = request.params ?? {};
    for (const key of ['id', 'roomId', 'hotelId', 'guideId', 'bookingId']) {
      const value = params[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }

    // Creations have no path id; take it from the response body instead.
    if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>;
      const data =
        body.data && typeof body.data === 'object'
          ? (body.data as Record<string, unknown>)
          : body;
      for (const key of ['id', 'entityId', 'broadcastId']) {
        const value = data[key];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    }

    return null;
  }
}
