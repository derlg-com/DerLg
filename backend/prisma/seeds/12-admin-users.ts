// =============================================================================
// Seed: 12 — Admin panel users (F110–F118)
// =============================================================================
// Creates one `users` row per admin role, each with a bcrypt password_hash and
// a matching `admin_users` row. These are the accounts used to sign in to the
// admin panel through the site's own /v1/auth/login — there is no separate
// admin credential store.
//
// Password comes from SEED_ADMIN_PASSWORD. The fallback is development-only and
// is refused when NODE_ENV=production so a well-known password can never reach
// a real deployment.
// =============================================================================

import bcrypt from 'bcrypt';

import type { PrismaClient, AdminRole, UserRole } from '@prisma/client';

interface AdminSeedEntry {
  email: string;
  fullName: string;
  /** Role on the `users` row — drives the JWT `role` claim. */
  userRole: UserRole;
  /** Role on the `admin_users` row — drives AdminRoleGuard. */
  adminRole: AdminRole;
  /** Per-user capability overrides, or null for role defaults. */
  permissions: Record<string, boolean> | null;
}

const ADMINS: AdminSeedEntry[] = [
  {
    email: 'admin@derlg.demo',
    fullName: 'Super Admin',
    userRole: 'super_admin',
    adminRole: 'SUPER_ADMIN',
    permissions: null,
  },
  {
    email: 'ops@derlg.demo',
    fullName: 'Operations Manager',
    userRole: 'operations_manager',
    adminRole: 'OPERATIONS_MANAGER',
    permissions: null,
  },
  {
    email: 'fleet@derlg.demo',
    fullName: 'Fleet Manager',
    userRole: 'fleet_manager',
    adminRole: 'FLEET_MANAGER',
    permissions: null,
  },
  {
    email: 'support@derlg.demo',
    fullName: 'Support Agent',
    userRole: 'support_agent',
    adminRole: 'SUPPORT_AGENT',
    permissions: null,
  },
];

function resolvePassword(): string {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_ADMIN_PASSWORD (min 8 chars) must be set when NODE_ENV=production. ' +
        'Refusing to seed admin accounts with the development fallback.',
    );
  }

  return 'DerLgAdmin!2026';
}

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • admin users');

  const password = resolvePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  for (const entry of ADMINS) {
    // Idempotent: upsert the user, then upsert its admin grant. Re-running
    // refreshes the password hash and role without creating duplicates.
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        role: entry.userRole,
        fullName: entry.fullName,
        passwordHash,
        status: 'active',
      },
      create: {
        supabaseUid: `seed-admin-${entry.adminRole.toLowerCase()}`,
        email: entry.email,
        role: entry.userRole,
        preferredLanguage: 'en',
        fullName: entry.fullName,
        passwordHash,
        status: 'active',
      },
      select: { id: true },
    });

    await prisma.adminUser.upsert({
      where: { userId: user.id },
      update: {
        adminRole: entry.adminRole,
        permissions: entry.permissions ?? undefined,
        isActive: true,
      },
      create: {
        userId: user.id,
        adminRole: entry.adminRole,
        permissions: entry.permissions ?? undefined,
        isActive: true,
      },
    });
  }

  // A deactivated admin so the AdminRoleGuard's isActive rejection path can be
  // exercised against real data rather than only in unit tests.
  const inactive = await prisma.user.upsert({
    where: { email: 'inactive.admin@derlg.demo' },
    update: { role: 'operations_manager', passwordHash, status: 'active' },
    create: {
      supabaseUid: 'seed-admin-inactive',
      email: 'inactive.admin@derlg.demo',
      role: 'operations_manager',
      preferredLanguage: 'en',
      fullName: 'Deactivated Admin',
      passwordHash,
      status: 'active',
    },
    select: { id: true },
  });

  await prisma.adminUser.upsert({
    where: { userId: inactive.id },
    update: { adminRole: 'OPERATIONS_MANAGER', isActive: false },
    create: {
      userId: inactive.id,
      adminRole: 'OPERATIONS_MANAGER',
      isActive: false,
    },
  });

  console.log(
    `  ✅ Created ${ADMINS.length} admin users + 1 deactivated` +
      (process.env.SEED_ADMIN_PASSWORD
        ? ' (password from SEED_ADMIN_PASSWORD)'
        : ' (dev fallback password)'),
  );
};
