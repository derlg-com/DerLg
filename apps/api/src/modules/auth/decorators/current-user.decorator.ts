import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedUser } from '../interfaces/auth.interface';

/** Injects the authenticated principal set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      // Reaching here means a controller used @CurrentUser without a guard.
      throw new Error('CurrentUser used on a route without JwtAuthGuard');
    }
    return request.user;
  },
);
