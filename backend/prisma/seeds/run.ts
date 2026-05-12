// =============================================================================
// DerLg — Seed Runner
// =============================================================================
// Runs all seed files in dependency order.
//
// Usage:
//   npx ts-node prisma/seeds/run.ts
//   npx prisma db seed          (if `"prisma": { "seed": "..." }` in package.json)
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 DerLg — Database Seeding\n');

  // 1. Static / reference data first
  await require('./01-languages')(prisma);
  await require('./02-emergency-contacts')(prisma);
  await require('./03-exchange-rates')(prisma);

  // 2. Operational data
  await require('./04-places')(prisma);
  await require('./05-hotels')(prisma);
  await require('./06-transportation')(prisma);
  await require('./07-guides')(prisma);
  await require('./08-trips')(prisma);
  await require('./09-festivals')(prisma);

  // 3. Promo / config data
  await require('./10-discount-codes')(prisma);

  console.log('\n✅ Seed complete.\n');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
