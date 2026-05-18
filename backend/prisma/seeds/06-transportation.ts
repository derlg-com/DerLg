// =============================================================================
// Seed: 06 — Transportation vehicles (tuk-tuk, van, bus)
// =============================================================================

import type { PrismaClient } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface VehicleEntry {
  vehicleType: 'tuk_tuk' | 'van' | 'bus';
  name: string;
  licensePlate?: string;
  capacity: number;
  pricingModel: 'per_day' | 'per_km';
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
    name: 'Siem Reap Comfort Van',
    licensePlate: '1EF-3456',
    capacity: 12,
    pricingModel: 'per_day',
    priceUsd: 80,
    province: 'Siem Reap',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'van',
    name: 'Phnom Penh VIP Van',
    licensePlate: '2GH-7890',
    capacity: 10,
    pricingModel: 'per_day',
    priceUsd: 90,
    province: 'Phnom Penh',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'van',
    name: 'Sihanoukville Beach Van',
    licensePlate: '4IJ-1234',
    capacity: 14,
    pricingModel: 'per_day',
    priceUsd: 85,
    province: 'Preah Sihanouk',
    images: [imageUrls['transport/van.jpg']],
  },
  {
    vehicleType: 'bus',
    name: 'Cambodia Express Bus',
    licensePlate: '1KL-5678',
    capacity: 40,
    pricingModel: 'per_km',
    priceUsd: 5,
    province: 'Siem Reap',
    images: [imageUrls['transport/bus.jpg']],
  },
  {
    vehicleType: 'bus',
    name: 'Mekong Deluxe Coach',
    licensePlate: '2MN-9012',
    capacity: 35,
    pricingModel: 'per_km',
    priceUsd: 6,
    province: 'Phnom Penh',
    images: [imageUrls['transport/bus.jpg']],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • transportation_vehicles');

  for (const v of VEHICLES) {
    await prisma.transportationVehicle.create({
      data: {
        vehicleType: v.vehicleType,
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
