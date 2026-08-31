import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Injects the decoded JWT payload, or one claim from it.
 *
 *   `@CurrentUser() user: JwtPayload`   → the whole payload
 *   `@CurrentUser('sub') userId: string` → just that claim
 *
 * The single-claim form previously did not work: the decorator declared its
 * argument as `_data: unknown` and ignored it, always returning the whole
 * payload. Since 41 call sites annotate the parameter as `string`, they were all
 * silently receiving an object that TypeScript believed was a string — the
 * decorator's declared return type masked the mismatch.
 *
 * The visible symptom was that every explicit `createAuditLog(...)` call in the
 * admin module failed Prisma validation on `userId` and was swallowed by that
 * method's try/catch, so admin actions logged no metadata. `AuditInterceptor`
 * kept writing its own coarser rows, which is why the failure went unnoticed.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    // Public routes have no authenticated user; returning undefined lets
    // optional parameters stay undefined rather than throwing.
    if (!user) return undefined;

    return data ? user[data] : user;
  },
);
