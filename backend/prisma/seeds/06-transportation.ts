// =============================================================================
// Seed: 06 — Transportation vehicles (tuk-tuk, van, bus)
// P3 hierarchy: van+normal→Starex(9), van+vip→Hiace(10)/Alphard(7),
// bus→small_bus(25)/big_bus(45), tuk_tuk unchanged.
// =============================================================================

import type { PrismaClient, VehicleType, VehicleTier, VehicleSubtype, PricingModel } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface VehicleEntry {
  vehicleType: VehicleType;
  tier?: VehicleTier;
  subtype?: VehicleSubtype;
  name: string;
  licensePlate?: string;
  capacity: number;
  pricingModel: PricingModel;
  priceUsd: number;
  province: string;
  images: string[];
}

const VEHICLES: VehicleEntry[] = [
  {
    vehicleType: 'tuk_tuk',
    name: 'Siem Reap Tuk-Tuk Classic',
    licensePlate: '1AB-1234',
    capacity: 3,
    pricingModel: 'per_day',
    priceUsd: 25,
    province: 'Siem Reap',
    images: [imageUrls['transport/tuk-tuk.jpg']],
  },
  {
    vehicleType: 'tuk_tuk',
    name: 'Phnom Penh City Tuk-Tuk',
    licensePlate: '2BC-5678',
    capacity: 3,
    pricingModel: 'per_km',
    priceUsd: 2,
    province: 'Phnom Penh',
    images: [imageUrls['transport/tuk-tuk.jpg']],
  },
  {
    vehicleType: 'tuk_tuk',
    name: 'Kampot Scenic Tuk-Tuk',
    licensePlate: '3CD-9012',
    capacity: 3,
    pricingModel: 'per_day',
    priceUsd: 20,
    province: 'Kampot',
    images: [imageUrls['transport/tuk-tuk.jpg']],
  },
  {
    vehicleType: 'van',
    tier: 'normal',
    subtype: 'starex',
    name: 'Siem Reap Starex Van',
    licensePlate: '1EF-3456',
    capacity: 9,
    pricingModel: 'per_day',
    priceUsd: 80,
    province: 'Siem Reap',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'van',
    tier: 'vip',
    subtype: 'hiace',
    name: 'Phnom Penh VIP Hiace',
    licensePlate: '2GH-7890',
    capacity: 10,
    pricingModel: 'per_day',
    priceUsd: 90,
    province: 'Phnom Penh',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'van',
    tier: 'vip',
    subtype: 'alphard',
    name: 'Sihanoukville Alphard Limo',
    licensePlate: '4IJ-1234',
    capacity: 7,
    pricingModel: 'per_day',
    priceUsd: 110,
    province: 'Preah Sihanouk',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'bus',
    tier: 'normal',
    subtype: 'small_bus',
    name: 'Cambodia Express Minibus',
    licensePlate: '1KL-5678',
    capacity: 25,
    pricingModel: 'per_km',
    priceUsd: 5,
    province: 'Siem Reap',
    images: [imageUrls['transport/bus.jpg']],
  },
  {
    vehicleType: 'bus',
    tier: 'normal',
    subtype: 'big_bus',
    name: 'Mekong Deluxe Coach',
    licensePlate: '2MN-9012',
    capacity: 45,
    pricingModel: 'per_km',
    priceUsd: 6,
    province: 'Phnom Penh',
    images: [imageUrls['transport/bus.jpg']],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • transportation_vehicles');

  // Idempotent reseed: clear existing vehicles first (booking items reference
  // vehicles via onDelete: SetNull, so this is safe on repeated seeding).
  await prisma.transportationVehicle.deleteMany({});

  for (const v of VEHICLES) {
    await prisma.transportationVehicle.create({
      data: {
        vehicleType: v.vehicleType,
        tier: v.tier,
        subtype: v.subtype,
        name: v.name,
        licensePlate: v.licensePlate,
        capacity: v.capacity,
        pricingModel: v.pricingModel,
        priceUsd: v.priceUsd,
        province: v.province,
        images: v.images,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Created ${VEHICLES.length} vehicles`);
};
