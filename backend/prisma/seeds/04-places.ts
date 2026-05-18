// =============================================================================
// Seed: 04 — Places (temples, museums, nature, markets, beaches, mountains)
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface PlaceEntry {
  category: 'temple' | 'museum' | 'nature' | 'market' | 'beach' | 'mountain';
  lat: number;
  lng: number;
  images: string[];
  translations: { lang: SupportedLanguage; name: string; description: string; tips: string; address: string }[];
  entryFee?: number;
  openingHours?: string;
  dressCode?: string;
}

const PLACES: PlaceEntry[] = [
  {
    category: 'temple',
    lat: 13.4125,
    lng: 103.8670,
    images: [imageUrls['places/angkor-wat.jpg']],
    entryFee: 37,
    openingHours: '05:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Angkor Wat', description: 'The largest religious monument in the world, this 12th-century temple complex is the crown jewel of Khmer architecture and a symbol of Cambodia.', tips: 'Arrive at sunrise for the best photos. Hire a licensed guide to learn the history.', address: 'Siem Reap, Cambodia' },
      { lang: 'zh', name: '吴哥窟', description: '世界上最大的宗教建筑，这座12世纪的寺庙建筑群是高棉建筑的瑰宝，也是柬埔寨的象征。', tips: '建议日出时抵达，拍照效果最佳。聘请持证导游了解历史。', address: '柬埔寨暹粒省' },
      { lang: 'km', name: 'អង្គរវត្ត', description: 'ប្រាសាទសាសនាធំជាងគេបំផុតនៅលើពិភពលោក ប្រាសាទសតវត្សទី១២នេះជាត្បូងរបស់ស្ថាបត្យកម្មខ្មែរ និងជាសញ្ញាសម្គាល់នៃប្រទេសកម្ពុជា។', tips: 'មកដល់ពេលថ្ងៃរះដើម្បីថតរូបល្អបំផុត។ ជួលមគ្គុទេសក៍មានអាជ្ញាប័ណ្ណដើម្បីសិក្សាប្រវត្តិសាស្រ្ត។', address: 'ខេត្តសៀមរាប ប្រទេសកម្ពុជា' },
    ],
  },
  {
    category: 'temple',
    lat: 13.4414,
    lng: 103.8585,
    images: [imageUrls['places/bayon-temple.jpg']],
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Bayon Temple', description: 'Famous for its 216 serene stone faces carved into towering pillars, Bayon sits at the heart of Angkor Thom and represents the intersection of Buddhism and Hinduism.', tips: 'Visit in the morning light when the stone faces glow. Look for the bas-reliefs depicting daily Khmer life.', address: 'Angkor Thom, Siem Reap' },
      { lang: 'zh', name: '巴戎寺', description: '以其216座雕刻在高耸石柱上的宁静石脸而闻名，巴戎寺位于吴哥通王城的中心，代表着佛教与印度教的交汇。', tips: '早晨光线照射时石脸会发光，此时参观最佳。寻找描绘高棉日常生活的浮雕。', address: '暹粒吴哥通王城' },
      { lang: 'km', name: 'ប្រាសាទបាយ័ន', description: 'ល្បីល្បាញដោយមុខថ្មសន្តិភាព ២១៦ មុខដែលឆ្លាក់លើជញ្ជឹងខ្ពស់ បាយ័នស្ថិតនៅកណ្តាលអង្គរធំ និងតំណាងឱ្យការប្រសព្វគ្នារវាងព្រះពុទ្ធសាសនា និងហិណ្ឌូសាសនា។', tips: 'មកពេលព្រឹកពន្លូញពន្លឺព្រះអាទិត្យលាតសន្ធឹងលើមុខថ្ម។ រកមើលរូបចម្លាក់បញ្ច្រាសដែលបង្ហាញពីជីវិតប្រចាំថ្ងៃរបស់ប្រជាជនខ្មែរ។', address: 'អង្គរធំ សៀមរាប' },
    ],
  },
  {
    category: 'temple',
    lat: 13.4347,
    lng: 103.8894,
    images: [imageUrls['places/ta-prohm.jpg']],
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Ta Prohm', description: 'Known as the "Tomb Raider temple," this mystical ruin has been swallowed by the jungle, with massive tree roots entwining ancient stone walls.', tips: 'Go early to avoid crowds. The giant spung trees are most photogenic in soft morning light.', address: 'Siem Reap, Cambodia' },
      { lang: 'zh', name: '塔布茏寺', description: '被称为"古墓丽影寺"，这座神秘的废墟已被丛林吞噬，巨大的树根缠绕着古老的石墙。', tips: '早点去避开人群。巨大的榕树在柔和的晨光中最适合拍照。', address: '柬埔寨暹粒' },
      { lang: 'km', name: 'ប្រាសាទតាព្រហ្ម', description: 'ដែលត្រូវបានស្គាល់ថាជា "ប្រាសាទ Tomb Raider" ប្រាសាទបុរាណដ៏អាថ៌កំបាំងនេះត្រូវបានព្រៃភ្នំព្រះពកពាណិជ្ជកម្ម ដែលឫសឈើយក្សាដ៏ធំធេងបានព័ទ្ធជុំវិញជញ្ជឹងថ្មបុរាណ។', tips: 'ទៅមុនដើម្បីជៀសវាងចំនួនមនុស្សច្រើន។ ដើមឈើស្ពង់ដ៏ធំពណ៌សម្បូរណ៍បំផុតនៅក្រោមពន្លឺព្រះអាទិត្យព្រឹក។', address: 'សៀមរាប ប្រទេសកម្ពុជា' },
    ],
  },
  {
    category: 'museum',
    lat: 11.5694,
    lng: 104.9311,
    images: [imageUrls['places/phnom-penh-royal-palace.jpg']],
    entryFee: 10,
    openingHours: '08:00–11:00, 14:00–17:00',
    dressCode: 'Smart casual, no shorts',
    translations: [
      { lang: 'en', name: 'Royal Palace & Silver Pagoda', description: 'The official residence of the King of Cambodia, featuring the stunning Silver Pagoda with its floor covered in 5,000 silver tiles and the Emerald Buddha.', tips: 'Wear proper attire. Photography is restricted inside the Silver Pagoda.', address: 'Sothearos Blvd, Phnom Penh' },
      { lang: 'zh', name: '金边皇宫与银塔', description: '柬埔寨国王的官邸，拥有令人惊叹的银塔，其地板由5000块银砖铺成，还有翡翠佛。', tips: '穿着得体。银塔内禁止拍照。', address: '金边索蒂罗斯大道' },
      { lang: 'km', name: 'ព្រះបរមរាជវាំង និងវត្តព្រះកែវមរកត', description: 'ទីលំនៅផ្លូវការរបស់ព្រះមហាក្សត្រកម្ពុជា ដែលមានវត្តព្រះកែវមរកតដ៏សែនស្អាតដែលផ្ទះបាតគ្របដណ្តប់ដោយក្រដាសប្រាក់ ៥០០០ សន្លឹក និងព្រះពុទ្ធសមធម៌កែវ។', tips: 'ស្លៀកពាក់សមរម្យ។ ការថតរូបត្រូវបានហាមឃាត់នៅខាងក្នុងវត្តព្រះកែវមរកត។', address: 'មហាវិថីសុធារស ភ្នំពេញ' },
    ],
  },
  {
    category: 'beach',
    lat: 10.6403,
    lng: 103.5075,
    images: [imageUrls['places/sihanoukville-beach.jpg']],
    entryFee: 0,
    openingHours: 'Open 24 hours',
    dressCode: 'Casual beachwear',
    translations: [
      { lang: 'en', name: 'Otres Beach', description: 'A serene stretch of white sand and turquoise waters, Otres is Sihanoukville\'s most relaxed beach, perfect for sunset cocktails and beachside dining.', tips: 'Visit during dry season (Nov–Apr). Try the fresh seafood at beach shacks.', address: 'Sihanoukville, Cambodia' },
      { lang: 'zh', name: '奥特雷斯海滩', description: '一片宁静的白色沙滩和碧绿的海水，奥特雷斯是西哈努克港最悠闲的海滩，非常适合日落鸡尾酒和海滩边用餐。', tips: '旱季（11月至4月）前往。尝试海滩小屋的新鲜海鲜。', address: '柬埔寨西哈努克港' },
      { lang: 'km', name: 'ឆ្នេរអូត្រេស', description: 'ឆ្នេរខ្សាច់សរលោកិយដ៏សែនសមុទ្រនិងទឹកពណ៌ត្រួយចតុបត្តិល័យ អូត្រេសជាឆ្នេរសម្រាកលំហែដ៏ល្អបំផុតនៃព្រះសីហនុ ល្អឥតខ្ចោះសម្រាប់កូកទែលពេលល្ងាច និងអាហារពេលល្ងាច។', tips: 'ទស្សនាក្នុងរដូវប្រេង (វិច្ឆិកា–មេសា)។ សាកល្ប់អាហារសមុទ្រស្រស់ៗនៅតាមខ្ទះឆ្នេរ។', address: 'ព្រះសីហនុ ប្រទេសកម្ពុជា' },
    ],
  },
  {
    category: 'nature',
    lat: 12.4833,
    lng: 104.0667,
    images: [imageUrls['places/tonle-sap.jpg']],
    entryFee: 5,
    openingHours: '08:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'Tonle Sap Lake', description: 'Southeast Asia\'s largest freshwater lake, Tonle Sap is a biosphere reserve with floating villages, rich birdlife, and a unique reversing flow during the monsoon.', tips: 'Take a boat tour from Chong Khneas or Kampong Phluk. Best visited during wet season (Jun–Nov) when water levels are high.', address: 'Siem Reap Province' },
      { lang: 'zh', name: '洞里萨湖', description: '东南亚最大的淡水湖，洞里萨湖是一个生物圈保护区，拥有 floating villages、丰富的鸟类资源和季风期间独特的逆流现象。', tips: '从 Chong Khneas 或 Kampong Phluk 乘船游览。雨季（6月至11月）水位高时最适合参观。', address: '暹粒省' },
      { lang: 'km', name: 'បឹងទន្លេសាប', description: 'បឹងទឹកផុសធំជាងគេនៅអាស៊ីអាគ្នេយ៍ ទន្លេសាបជាមណ្ឌលជីវមណ្ឌលជាមួយភូមិលើទឹក ជីវិតបក្សីច្រើនសម្បូរ និងការហូរទឹកត្រឡប់ដ៏ពិសេសក្នុងអំឡុងរដូវវស្សា។', tips: 'ជិះទូកពីជ័យ ឬកំពង់ភ្លុក។ ទស្សនាល្អបំផុតក្នុងរដូវវស្សា (មិថុនា–វិច្ឆិកា) នៅពេលដែលកម្រិតទឹកខ្ពស់។', address: 'ខេត្តសៀមរាប' },
    ],
  },
  {
    category: 'museum',
    lat: 11.4844,
    lng: 104.9019,
    images: [imageUrls['places/killing-fields.jpg']],
    entryFee: 6,
    openingHours: '08:00–17:30',
    dressCode: 'Respectful attire',
    translations: [
      { lang: 'en', name: 'Choeung Ek Killing Fields', description: 'A somber memorial to the victims of the Khmer Rouge regime, this site features a stupa filled with 8,000 human skulls and informative audio tours.', tips: 'Allow 1–2 hours. The audio guide is highly recommended. Dress respectfully.', address: 'Phnom Penh, Cambodia' },
      { lang: 'zh', name: '钟屋杀人场', description: '红色高棉政权受害者的庄严纪念地，这座遗址有一座佛塔，里面安放着8000个人类头骨，还有信息丰富的语音导览。', tips: '预留1-2小时。强烈推荐使用语音导览。穿着得体。', address: '柬埔寨金边' },
      { lang: 'km', name: 'វាលពិឃាតជើងឯក', description: 'សម្ណាក់ឧទ្ទិសដល់ជនរងគ្រោះនៃរបបខ្មែរក្រហម ទីតាំងនេះមានចេតិយដែលពោរពេញដោយមួករៀមមនុស្ស ៨០០០ និងដំណើរណែនាំសំឡេងដែលមានព័ត៌មានច្រើន។', tips: 'ចាក់ពេល ១-២ ម៉ោង។ ការណែនាំសំឡេងត្រូវបានណែនាំយ៉ាងខ្លាំង។ ស្លៀកពាក់ដ៏គួរឱ្យគោរព។', address: 'ភ្នំពេញ ប្រទេសកម្ពុជា' },
    ],
  },
  {
    category: 'museum',
    lat: 11.5686,
    lng: 104.9281,
    images: [imageUrls['places/national-museum.jpg']],
    entryFee: 10,
    openingHours: '08:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'National Museum of Cambodia', description: 'Housing the world\'s finest collection of Khmer art, this beautiful terracotta building showcases sculptures from the Angkor period and pre-Angkor eras.', tips: 'Combine with a visit to the Royal Palace next door. Allow 1–2 hours.', address: 'Street 13, Phnom Penh' },
      { lang: 'zh', name: '柬埔寨国家博物馆', description: '拥有世界上最精美的高棉艺术收藏，这座美丽的赤陶建筑展示了吴哥时期和吴哥前时代的雕塑。', tips: '与隔壁的皇宫一起参观。预留1-2小时。', address: '金边13街' },
      { lang: 'km', name: 'សារមន្ទីរជាតិកម្ពុជា', description: 'ដែលមានស្តុកសំណង់សិល្បៈខ្មែរល្អបំផុតនៅលើពិភពលោក អគារដីឥដ្ឋស្រស់ស្អាតនេះបង្ហាញរូបចម្លាក់ពីសម័យអង្គរ និងមុនអង្គរ។', tips: 'ចូលរួមជាមួយការទស្សនាវាលពិឃាតជើងឯកដែលស្ថិតនៅជិតខាង។ ចាក់ពេល ១-២ ម៉ោង។', address: 'ផ្លូវ១៣ ភ្នំពេញ' },
    ],
  },
  {
    category: 'mountain',
    lat: 10.6167,
    lng: 104.0500,
    images: [imageUrls['places/bokor-mountain.jpg']],
    entryFee: 2,
    openingHours: 'Open 24 hours',
    dressCode: 'Warm layers — it gets cold at 1,000m',
    translations: [
      { lang: 'en', name: 'Bokor Mountain', description: 'A misty plateau at 1,081 meters in the Elephant Mountains, Bokor offers cooler temperatures, abandoned French colonial buildings, and panoramic coastal views.', tips: 'Bring a jacket. The old casino and church are eerie but fascinating. Combine with a visit to nearby pepper plantations.', address: 'Kampot Province' },
      { lang: 'zh', name: '波哥山', description: '位于象山海拔1081米的迷雾高原，波哥山提供凉爽的气温、废弃的法国殖民建筑全景海岸景观。', tips: '带件夹克。旧赌场和教堂阴森但迷人。可以顺便参观附近的胡椒种植园。', address: '贡布省' },
      { lang: 'km', name: 'ភ្នំបូកគោ', description: 'វាលខ្ពង់ព្រិលនៅកម្ពស់ ១០៨១ ម៉ែត្រនៅក្នុងភ្នំដំរី បូកគោមានសីតុណ្ហភាពត្រជាក់ អគារសម័យអាណានិគមបារាំងដែលបោះបង់ចោល និងទិដ្ឋភាពមហាសមុទ្រដ៏ធំទូលាយ។', tips: 'នាំយកអាវ។ កាស៊ីណូ និងព្រះវិហារចាស់គួរឱ្យខ្លាចប៉ុន្តែគួរឱ្យចាប់អារម្មណ៍។ ចូលរួមជាមួយការទស្សនាចំការម្រេចដែលស្ថិតនៅជិតខាង។', address: 'ខេត្តកំពត' },
    ],
  },
  {
    category: 'nature',
    lat: 13.7333,
    lng: 106.9833,
    images: [imageUrls['places/ratanakiri-nature.jpg']],
    entryFee: 0,
    openingHours: 'Open 24 hours',
    dressCode: 'Outdoor gear',
    translations: [
      { lang: 'en', name: 'Yeak Lom Crater Lake', description: 'A perfectly circular volcanic lake surrounded by dense forest in Ratanakiri province. This sacred Tampuan ethnic minority site offers swimming and jungle trekking.', tips: 'Hire a local Tampuan guide. Visit early morning for birdwatching. The water is incredibly clear.', address: 'Ratanakiri Province' },
      { lang: 'zh', name: '亚克朗火山口湖', description: '腊塔纳基里省一个完美的圆形火山湖，周围环绕着茂密的森林。这个神圣的他蓬族少数民族遗址提供游泳和丛林徒步。', tips: '聘请当地他蓬族导游。清晨前往观鸟。湖水非常清澈。', address: '腊塔纳基里省' },
      { lang: 'km', name: 'បឹងយាកឡម', description: 'បឹងភ្នំភ្លើងរង្វង់ស្រដៀងគ្នាដ៏ល្អឥតខ្ចោះ ដែលព័ទ្ធជុំវិញដោយព្រៃភ្នំនៅខេត្តរតនគិរី។ ទីតាំងដ៏ពិសិដ្ឋនេះនៃជនជាតិដើមភាគតិចតំបូងផ្តល់នូវការហែលទឹក និងការដើរព្រៃភ្នំ។', tips: 'ជួលមគ្គុទេសក៍តំបូងក្នុងស្រុក។ ទស្សនាពេលព្រឹកព្រលឹមសម្រាប់ការមើលបក្សី។ ទឹកគឺថែមទាំងថ្លាមិនគួរឱ្យជឿ។', address: 'ខេត្តរតនគិរី' },
    ],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • places');

  for (const p of PLACES) {
    await prisma.place.create({
      data: {
        category: p.category,
        latitude: p.lat,
        longitude: p.lng,
        images: p.images,
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
  console.log(`  ✅ Created ${PLACES.length} places`);
};
