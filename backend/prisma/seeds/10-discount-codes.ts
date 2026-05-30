// =============================================================================
// Seed: 10 — Discount codes
// =============================================================================

import type { PrismaClient } from '@prisma/client';

interface DiscountCodeEntry {
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  maxUses?: number;
  minBookingUsd?: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  bookingType?: 'trip_package' | 'hotel_room' | 'transportation' | 'tour_guide';
}

const DISCOUNT_CODES: DiscountCodeEntry[] = [
  {
    code: 'WELCOME20',
    discountType: 'percentage',
    value: 20,
    maxUses: 100,
    minBookingUsd: 50,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    isActive: true,
  },
  {
    code: 'ANGKOR15',
    discountType: 'percentage',
    value: 15,
    maxUses: 200,
    minBookingUsd: 100,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    isActive: true,
    bookingType: 'trip_package',
  },
  {
    code: 'HOTEL50',
    discountType: 'fixed_amount',
    value: 50,
    maxUses: 50,
    minBookingUsd: 200,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    isActive: true,
    bookingType: 'hotel_room',
  },
  {
    code: 'GUIDE10',
    discountType: 'percentage',
    value: 10,
    maxUses: 100,
    minBookingUsd: 30,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    isActive: true,
    bookingType: 'tour_guide',
  },
  {
    code: 'TRANSPORT25',
    discountType: 'fixed_amount',
    value: 25,
    maxUses: 75,
    minBookingUsd: 80,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    isActive: true,
    bookingType: 'transportation',
  },
  {
    code: 'SUMMER2026',
    discountType: 'percentage',
    value: 25,
    maxUses: 500,
    minBookingUsd: 75,
    validFrom: '2026-06-01T00:00:00Z',
    validUntil: '2026-08-31T23:59:59Z',
    isActive: true,
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • discount_codes');

  for (const d of DISCOUNT_CODES) {
    await prisma.discountCode.upsert({
      where: { code: d.code },
      create: {
        code: d.code,
        discountType: d.discountType,
        value: d.value,
        maxUses: d.maxUses,
        minBookingUsd: d.minBookingUsd,
        validFrom: new Date(d.validFrom),
        validUntil: new Date(d.validUntil),
        isActive: d.isActive,
        bookingType: d.bookingType,
      },
      update: {},
    });
  }
  console.log(`  ✅ Created ${DISCOUNT_CODES.length} discount codes`);
};
