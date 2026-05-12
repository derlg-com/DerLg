// =============================================================================
// Seed: 04 — Places (temples, museums, nature, markets, beaches, mountains)
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

interface PlaceEntry {
  category: 'temple' | 'museum' | 'nature' | 'market' | 'beach' | 'mountain';
  lat: number;
  lng: number;
  translations: { lang: SupportedLanguage; name: string; description: string; tips: string; address: string }[];
  entryFee?: number;
  openingHours?: string;
  dressCode?: string;
}

const PLACES: PlaceEntry[] = [
  {
    category: 'temple', lat: 13.4125, lng: 103.8670,
    entryFee: 37, openingHours: '05:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Angkor Wat', description: 'The largest religious monument in the world...', tips: 'Arrive at sunrise for the best photos', address: 'Siem Reap, Cambodia' },
      { lang: 'zh', name: '吴哥窟', description: '世界上最大的宗教建筑...', tips: '建议日出时抵达，拍照效果最佳', address: '柬埔寨暹粒省' },
      { lang: 'km', name: 'អង្គរវត្ត', description: 'ប្រាសាទសាសនាធំជាងគេបំផុតនៅលើពិភពលោក...', tips: 'មកដល់ពេលថ្ងៃរះដើម្បីថតរូបល្អបំផុត', address: 'ខេត្តសៀមរាប ប្រទេសកម្ពុជា' },
    ],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • places');

  for (const p of PLACES) {
    const place = await prisma.place.create({
      data: {
        category: p.category,
        latitude: p.lat,
        longitude: p.lng,
        entryFeeUsd: p.entryFee,
        openingHours: p.openingHours,
        dressCode: p.dressCode,
        isPublished: true,
        translations: {
          create: p.translations.map((t) => ({
            language: t.lang,
            name: t.name,
            description: t.description,
            visitorTips: t.tips,
            address: t.address,
          })),
        },
      },
    });
  }
}