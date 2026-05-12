// =============================================================================
// Seed: 01 — Language constants
// =============================================================================
// Reference seed — always safe to re-run (upserts on natural keys).
// =============================================================================

import type { PrismaClient } from '@prisma/client';

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • languages — nothing to seed (enum-backed), skipping');
}