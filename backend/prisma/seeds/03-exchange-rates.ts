// =============================================================================
// Seed: 03 — Exchange rates (USD → KHR, USD → CNY defaults)
// =============================================================================

import type { PrismaClient } from '@prisma/client';

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • exchange_rates');

  await prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency: 'usd', toCurrency: 'khr' } },
    create: { fromCurrency: 'usd', toCurrency: 'khr', rate: 4100 },
    update: {},
  });

  await prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency: { fromCurrency: 'usd', toCurrency: 'cny' } },
    create: { fromCurrency: 'usd', toCurrency: 'cny', rate: 7.25 },
    update: {},
  });
}