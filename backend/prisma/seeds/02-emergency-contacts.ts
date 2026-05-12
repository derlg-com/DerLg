// =============================================================================
// Seed: 02 — Emergency contacts (25 provinces × 4 services)
// =============================================================================

import type { PrismaClient } from '@prisma/client';

const PROVINCES = [
  'Banteay Meanchey', 'Battambang', 'Kampong Cham', 'Kampong Chhnang',
  'Kampong Speu', 'Kampong Thom', 'Kampot', 'Kandal', 'Koh Kong', 'Kratié',
  'Mondulkiri', 'Phnom Penh', 'Preah Vihear', 'Prey Veng', 'Pursat',
  'Ratanakiri', 'Siem Reap', 'Preah Sihanouk', 'Stung Treng', 'Svay Rieng',
  'Takéo', 'Oddar Meanchey', 'Kep', 'Pailin', 'Tboung Khmum',
];

const SERVICES = ['Police', 'Hospital', 'Fire', 'Tourist Police'];

const PHONES: Record<string, string> = {
  Police: '117', Hospital: '119', Fire: '118', 'Tourist Police': '012-942-484',
};

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • emergency_contacts');

  for (const province of PROVINCES) {
    for (const service of SERVICES) {
      await prisma.emergencyContact.upsert({
        where: { province_serviceName: { province, serviceName: service } },
        create: { province, serviceName: service, phone: PHONES[service] },
        update: {},
      });
    }
  }
}