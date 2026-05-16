// =============================================================================
// DerLg — Prisma Client Singleton
// =============================================================================
// This file creates a singleton PrismaClient instance.
// It will be replaced by the proper PrismaModule in Phase 1 (Track 1).
// =============================================================================

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
