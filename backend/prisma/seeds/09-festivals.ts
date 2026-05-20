// =============================================================================
// Seed: 09 — Festivals (Khmer New Year, Water Festival, etc.)
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface FestivalEntry {
  startDate: string;
  endDate: string;
  province?: string;
  images: string[];
  translations: { lang: SupportedLanguage; name: string; description: string; location?: string }[];
}

const FESTIVALS: FestivalEntry[] = [
  {
    startDate: '2026-04-14',
    endDate: '2026-04-16',
    province: 'Nationwide',
    images: [imageUrls['festivals/khmer-new-year.jpg']],
    translations: [
      {
        lang: 'en',
        name: 'Khmer New Year (Choul Chnam Thmey)',
        description: 'Cambodia\'s biggest celebration marks the end of the harvest season. Three days of water fights, temple visits, traditional games, and family gatherings. Streets transform into joyful chaos as locals douse each other with water and talcum powder.',
        location: 'Throughout Cambodia',
      },
      {
        lang: 'zh',
        name: '高棉新年（宋干节）',
        description: '柬埔寨最大的庆祝活动标志着收获季节的结束。三天的水战、寺庙参观、传统游戏和家庭聚会。街道变成了欢乐的混乱，当地人用水和爽身粉互相泼洒。',
        location: '全柬埔寨',
      },
      {
        lang: 'km',
        name: 'បុណ្យចូលឆ្នាំខ្មែរ (ចូលឆ្នាំថ្មី)',
        description: 'ពិធីបុណ្យធំបំផុតរបស់កម្ពុជាសម្គាល់ចុងបញ្ចប់នៃរដូវកាលច្រូតកាត់។ បីថ្ងៃនៃការប្រយុទ្ធទឹក ទស្សនាវត្ត ល្បែងប្រពៃណី និងការជួបជុំគ្រួសារ។ ផ្លូវថ្នល់ប្រែក្លាយជាភាពរញ់រក់ដ៏រីករាយដែលប្រជាជនក្នុងស្រុកចាក់ទឹក និងម្សៅប៊ឺប៊យ៉ាល់លើគ្នា។',
        location: 'ទូទាំងប្រទេសកម្ពុជា',
      },
    ],
  },
  {
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    province: 'Phnom Penh',
    images: [imageUrls['festivals/water-festival.jpg']],
    translations: [
      {
        lang: 'en',
        name: 'Bon Om Touk (Water Festival)',
        description: 'The spectacular boat racing festival on the Tonle Sap River. Hundreds of elaborately decorated longboats compete while fireworks light up the Phnom Penh skyline. Millions of Cambodians converge on the capital for this three-day celebration of the river\'s reversing flow.',
        location: 'Phnom Penh Riverside',
      },
      {
        lang: 'zh',
        name: '送水节（龙舟节）',
        description: '洞里萨河上壮观的龙舟比赛节日。数百艘装饰华丽的长船参加比赛，烟花照亮金边的天际线。数百万柬埔寨人聚集在首都，庆祝为期三天的河流逆流节。',
        location: '金边河畔',
      },
      {
        lang: 'km',
        name: 'បុណ្យអុំទូក',
        description: 'ពិធីបុណ្យប្រណាំងទូកដ៏អស្ចារ្យនៅលើទន្លេសាប។ ទូកវែងរំលេចតុបតែងរាប់រយដើមប្រកួតប្រជែងខណៈពេលដែលផះរំលេចភ្លើងបំភ្លឺមេឃភ្នំពេញ។ ប្រជាជនកម្ពុជារាប់លាននាក់ប្រមូលផ្តុំនៅរាជធានីសម្រាប់ការប្រារព្ធពិធីបុណ្យបីថ្ងៃនៃការហូរទឹកត្រឡប់របស់ទន្លេ។',
        location: 'វាលរបងទន្លេភ្នំពេញ',
      },
    ],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • festivals');

  for (const f of FESTIVALS) {
    await prisma.festival.create({
      data: {
        startDate: new Date(f.startDate),
        endDate: new Date(f.endDate),
        province: f.province,
        images: f.images,
        isPublished: true,
        translations: {
          create: f.translations.map((t) => ({
            language: t.lang,
            name: t.name,
            description: t.description,
            location: t.location,
          })),
        },
      },
    });
  }
  console.log(`  ✅ Created ${FESTIVALS.length} festivals`);
};
