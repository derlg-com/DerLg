// =============================================================================
// Seed: 07 — Tour guides (Siem Reap, Phnom Penh, Kampot)
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface GuideEntry {
  bio: string;
  avatarUrl: string;
  images: string[];
  pricePerDayUsd: number;
  province: string;
  provinces: string[];
  languages: SupportedLanguage[];
  specialities: string[];
}

const GUIDES: GuideEntry[] = [
  {
    bio: 'Born and raised in Siem Reap, Sokha has been guiding visitors through Angkor for 15 years. His deep knowledge of Khmer history, Hindu mythology, and Buddhist symbolism brings the ancient stones to life.',
    avatarUrl: imageUrls['guides/guide-1.jpg'],
    images: [imageUrls['guides/guide-1.jpg']],
    pricePerDayUsd: 45,
    province: 'Siem Reap',
    provinces: ['Siem Reap', 'Battambang'],
    languages: ['en', 'km'],
    specialities: ['Angkor Wat historian', 'Khmer mythology expert', 'Photography guide'],
  },
  {
    bio: 'Dara is a certified archaeologist with a Master\'s degree in Southeast Asian Studies. He specializes in lesser-known temples and can take you off the beaten path to discover hidden ruins most tourists never see.',
    avatarUrl: imageUrls['guides/guide-2.jpg'],
    images: [imageUrls['guides/guide-2.jpg']],
    pricePerDayUsd: 55,
    province: 'Siem Reap',
    provinces: ['Siem Reap', 'Preah Vihear', 'Kampong Thom'],
    languages: ['en', 'zh', 'km'],
    specialities: ['Archaeology specialist', 'Hidden temples', 'Sunrise photography'],
  },
  {
    bio: 'Sopheap is a passionate food guide who knows every street food stall, hidden market, and family-run restaurant in Phnom Penh. Her tours combine culinary delights with stories of Cambodian resilience and culture.',
    avatarUrl: imageUrls['guides/guide-3.jpg'],
    images: [imageUrls['guides/guide-3.jpg']],
    pricePerDayUsd: 40,
    province: 'Phnom Penh',
    provinces: ['Phnom Penh', 'Kandal'],
    languages: ['en', 'zh', 'km'],
    specialities: ['Street food expert', 'Cultural storyteller', 'Market tours'],
  },
  {
    bio: 'Channary grew up in a farming family in Kampot and knows the countryside intimately. She specializes in nature tours, pepper plantation visits, and authentic village experiences that support local communities.',
    avatarUrl: imageUrls['guides/guide-4.jpg'],
    images: [imageUrls['guides/guide-4.jpg']],
    pricePerDayUsd: 35,
    province: 'Kampot',
    provinces: ['Kampot', 'Kep', 'Takeo'],
    languages: ['en', 'km'],
    specialities: ['Nature trekking', 'Pepper plantation tours', 'Village homestays'],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • guides');

  for (let i = 0; i < GUIDES.length; i++) {
    const g = GUIDES[i];
    const firstName = g.bio.split(' ')[0].toLowerCase();
    // Create a user for each guide first (guides need a userId)
    const user = await prisma.user.create({
      data: {
        supabaseUid: `guide-supabase-${Math.random().toString(36).substring(2, 10)}`,
        email: `guide.${firstName}.${i + 1}@derlg.demo`,
        role: 'guide',
        preferredLanguage: 'en',
        fullName: g.bio.split(' ')[0], // First name from bio
        avatarUrl: g.avatarUrl,
      },
    });

    const guide = await prisma.guide.create({
      data: {
        userId: user.id,
        bio: g.bio,
        avatarUrl: g.avatarUrl,
        images: g.images,
        pricePerDayUsd: g.pricePerDayUsd,
        province: g.province,
        provinces: g.provinces,
        isVerified: true,
        isActive: true,
      },
    });

    for (const lang of g.languages) {
      await prisma.guideLanguage.create({
        data: {
          guideId: guide.id,
          language: lang,
        },
      });
    }

    for (const spec of g.specialities) {
      await prisma.guideSpeciality.create({
        data: {
          guideId: guide.id,
          speciality: spec,
        },
      });
    }
  }
  console.log(`  ✅ Created ${GUIDES.length} guides`);
};
