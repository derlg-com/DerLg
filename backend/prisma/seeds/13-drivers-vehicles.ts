// =============================================================================
// Seed: 13 — Fleet: drivers and vehicle maintenance (F110–F118)
// =============================================================================
// Drivers are attached to the vehicles seeded by 06-transportation.ts. Each
// driver's PIN is bcrypt-hashed exactly as the Telegram registration flow does,
// so the seeded rows are indistinguishable from real ones.
//
// telegramId is left null for most drivers: that is the honest pre-registration
// state, and it lets the admin panel's "Telegram registration status" column
// show both cases.
// =============================================================================

import bcrypt from 'bcrypt';

import type {
  PrismaClient,
  DriverStatus,
  MaintenanceStatus,
} from '@prisma/client';

interface DriverEntry {
  driverName: string;
  driverId: string;
  phone: string;
  status: DriverStatus;
  preferredLanguage: string;
  /** Null models a driver who has not completed Telegram /start yet. */
  telegramId: bigint | null;
}

const DRIVERS: DriverEntry[] = [
  {
    driverName: 'Sok Piseth',
    driverId: 'DRV-001',
    phone: '+855120000001',
    status: 'AVAILABLE',
    preferredLanguage: 'km',
    telegramId: 900000001n,
  },
  {
    driverName: 'Chan Vuthy',
    driverId: 'DRV-002',
    phone: '+855120000002',
    status: 'AVAILABLE',
    preferredLanguage: 'en',
    telegramId: 900000002n,
  },
  {
    driverName: 'Kim Rithy',
    driverId: 'DRV-003',
    phone: '+855120000003',
    status: 'OFFLINE',
    preferredLanguage: 'km',
    telegramId: null,
  },
  {
    driverName: 'Long Sophea',
    driverId: 'DRV-004',
    phone: '+855120000004',
    status: 'BUSY',
    preferredLanguage: 'zh',
    telegramId: 900000004n,
  },
];

interface MaintenanceEntry {
  maintenanceType: string;
  status: MaintenanceStatus;
  daysFromNow: number;
  costUsd: number | null;
  notes: string | null;
}

const MAINTENANCE: MaintenanceEntry[] = [
  {
    maintenanceType: 'Routine service — 10,000 km',
    status: 'COMPLETED',
    daysFromNow: -20,
    costUsd: 85.0,
    notes: 'Oil, filters and brake inspection. No issues found.',
  },
  {
    maintenanceType: 'Air-conditioning repair',
    status: 'IN_MAINTENANCE',
    daysFromNow: -1,
    costUsd: 140.0,
    notes: 'Compressor replacement; vehicle unavailable until parts arrive.',
  },
  {
    maintenanceType: 'Tyre replacement (all four)',
    status: 'SCHEDULED',
    daysFromNow: 12,
    costUsd: null,
    notes: null,
  },
];

const DAY_MS = 86_400_000;

/** Date-only value for a @db.Date column, normalised to UTC midnight. */
function dateOnly(daysFromNow: number): Date {
  const d = new Date(Date.now() + daysFromNow * DAY_MS);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • drivers & maintenance');

  const vehicles = await prisma.transportationVehicle.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, capacity: true },
  });

  if (vehicles.length === 0) {
    console.log(
      '  ⚠️  no vehicles found — run 06-transportation first; skipping',
    );
    return;
  }

  // Idempotent: drop only the drivers this seed owns, matched on their
  // DRV-0xx identifiers. driver_assignments and support_tickets cascade;
  // emergency_alerts.driver_id is SetNull, so alert history survives.
  await prisma.driver.deleteMany({
    where: { driverId: { in: DRIVERS.map((d) => d.driverId) } },
  });

  // Every seeded driver shares one PIN — dev convenience only, and it is
  // stored hashed, never in plaintext.
  const pinHash = await bcrypt.hash('1234', 12);

  for (let i = 0; i < DRIVERS.length; i++) {
    const entry = DRIVERS[i];
    await prisma.driver.create({
      data: {
        driverName: entry.driverName,
        driverId: entry.driverId,
        telegramId: entry.telegramId,
        authPin: pinHash,
        phone: entry.phone,
        // Round-robin so more than one vehicle has a driver attached.
        vehicleId: vehicles[i % vehicles.length].id,
        status: entry.status,
        preferredLanguage: entry.preferredLanguage,
        lastTelegramActivity:
          entry.telegramId === null
            ? null
            : new Date(Date.now() - i * 3600_000),
      },
    });
  }

  // Maintenance history on the first vehicle, covering all three states so the
  // fleet screen has something to filter.
  await prisma.vehicleMaintenance.deleteMany({
    where: {
      vehicleId: vehicles[0].id,
      maintenanceType: { in: MAINTENANCE.map((m) => m.maintenanceType) },
    },
  });

  for (const m of MAINTENANCE) {
    await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: vehicles[0].id,
        maintenanceType: m.maintenanceType,
        scheduledDate: dateOnly(m.daysFromNow),
        completionDate:
          m.status === 'COMPLETED' ? dateOnly(m.daysFromNow) : null,
        maintenanceCost: m.costUsd,
        maintenanceNotes: m.notes,
        status: m.status,
      },
    });
  }

  console.log(
    `  ✅ Created ${DRIVERS.length} drivers across ${Math.min(DRIVERS.length, vehicles.length)} vehicles + ${MAINTENANCE.length} maintenance records`,
  );
};
