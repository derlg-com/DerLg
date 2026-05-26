import { SetMetadata } from '@nestjs/common';

/** Metadata key used by JwtAuthGuard to identify public routes. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route or controller as public (no JWT required). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
