// =============================================================================
// Seed: 11 — Places from /data directory (Phnom Penh + Siem Reap)
// =============================================================================
// Reads place folders from the data directory, maps each to a category by name,
// and seeds with EN / ZH / KM translations. Idempotent — skips any place whose
// English name already exists in the database.
//
// Run: npx ts-node prisma/seeds/11-places-from-data.ts
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

// ---------------------------------------------------------------------------
// Category mapping heuristic (by place name keywords)
// ---------------------------------------------------------------------------
function inferCategory(name: string): 'temple' | 'museum' | 'nature' | 'market' | 'beach' | 'mountain' {
  const n = name.toLowerCase();
  if (/(temple|wat|pagoda|angkor|bayon|banteay|baphuon|mebon|neak|preah|pre rup|bakheng|ta pros|terrace)/i.test(n)) return 'temple';
  if (/(museum|monument|palace|railway station|killing|tuol sleng|war museum|friendship)/i.test(n)) return 'museum';
  if (/(market|mall|pub street|psar|aeon|russian market|old market)/i.test(n)) return 'market';
  if (/(mountain|phnom kulen|kulen)/i.test(n)) return 'mountain';
  if (/(beach|otres|sihanoukville)/i.test(n)) return 'beach';
  // nature: lake, park, river, quay, floating village, jungle, crater, waterfall
  return 'nature';
}

// ---------------------------------------------------------------------------
// Translations for every place (EN / ZH / KM)
// ---------------------------------------------------------------------------
interface PlaceEntry {
  folder: string;
  lat: number;
  lng: number;
  category: ReturnType<typeof inferCategory>;
  imageKey: string;
  entryFee: number;
  openingHours: string;
  dressCode?: string;
  translations: { lang: SupportedLanguage; name: string; description: string; tips: string; address: string }[];
}

const PLACES: PlaceEntry[] = [
  // ============================================================
  // PHNOM PENH
  // ============================================================
  {
    folder: 'Aeon Mall Phnom Penh',
    lat: 11.5463, lng: 104.9392,
    category: 'market',
    imageKey: 'places/places-1.jpg',
    entryFee: 0,
    openingHours: '10:00–22:00',
    translations: [
      { lang: 'en', name: 'Aeon Mall Phnom Penh', description: 'The largest modern shopping mall in Phnom Penh, featuring international brands, a food court, cinema, and supermarket all under one roof.', tips: 'Great for escaping the heat. The basement food court has affordable local and international options.', address: '132 Samdach Sothearos Blvd, Phnom Penh' },
      { lang: 'zh', name: '金边永旺购物中心', description: '金边最大的现代购物中心，集国际品牌、美食广场、电影院和超市于一体。', tips: '适合避暑。地下美食广场有实惠的本地和国际美食。', address: '金边索蒂罗斯大道132号' },
      { lang: 'km', name: 'ផ្សារទំនើប AEON ភ្នំពេញ', description: 'ផ្សារទំនើបធំជាងគេនៅភ្នំពេញ មានម៉ាកអន្តរជាតិ ម្ហូបភូមិ ភាពយន្ត និងផ្សារទំនិញ។', tips: 'ល្អសម្រាប់ចាកចេញពីកំដៅ។ ម្ហូបភូមានៅជាន់ក្រោមមានម្ហូបក្នុងស្រុក និងអន្តរជាតិតម្លៃសមរម្យ។', address: 'ផ្លូវសម្តេចសុធារស ១៣២ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Cambodia Vietnam Friendship Monument',
    lat: 11.5519, lng: 104.9270,
    category: 'museum',
    imageKey: 'places/places-2.jpg',
    entryFee: 0,
    openingHours: 'Open 24 hours',
    translations: [
      { lang: 'en', name: 'Cambodia-Vietnam Friendship Monument', description: 'A large concrete monument built in the late 1970s to commemorate the alliance between Cambodia and Vietnam. It sits in a popular park near the Royal Palace.', tips: 'Best visited in the early morning or late afternoon when locals come to exercise. Good photo spot.', address: 'Wat Phnom Park, Phnom Penh' },
      { lang: 'zh', name: '柬越友谊纪念碑', description: '一座建于1970年代末的大型混凝土纪念碑，旨在纪念柬埔寨和越南之间的联盟。位于皇宫附近的热门公园内。', tips: '最好在清晨或傍晚参观，当地人会来此锻炼。拍照的好地方。', address: '金边塔山寺公园' },
      { lang: 'km', name: 'រូបសំណាកមិត្តភាពកម្ពុជា-វៀតណាម', description: 'រូបសំណាកកុងក្រែតធំមួយដែលសាងសង់នៅចុងទសវត្សរ៍ទី១៩៧០ ដើម្បីរំលឹកដល់សម្ព័ន្ធភាពរវាងកម្ពុជា និងវៀតណាម។', tips: 'ល្អបំផុតនៅពេលព្រឹក ឬល្ងាចនៅពេលប្រជាជនមកធ្វើលំហាត់ប្រាណ។', address: 'ឧទ្យានវត្តភ្នំ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Central Market Phsar Thmei',
    lat: 11.5694, lng: 104.9209,
    category: 'market',
    imageKey: 'places/places-3.jpg',
    entryFee: 0,
    openingHours: '07:00–17:30',
    translations: [
      { lang: 'en', name: 'Central Market (Phsar Thmei)', description: 'An iconic Art Deco market built in 1937, shaped like a dome with four wings. It is the heart of Phnom Penh commerce — selling everything from jewelry and gold to clothing, souvenirs, and fresh produce.', tips: 'Bargain hard — start at 50% of the asking price. The central dome area has the best jewelry stalls.', address: 'Street 128, Phnom Penh' },
      { lang: 'zh', name: '中央市场（塔仔山市场）', description: '一座建于1937年的标志性装饰艺术市场，形如圆顶，有四翼。它是金边商业的核心——从珠宝、黄金到服装、纪念品和新鲜农产品应有尽有。', tips: '大力还价——从要价的50%开始。中央圆顶区有最好的珠宝摊位。', address: '金边128街' },
      { lang: 'km', name: 'ផ្សារកណ្តាល (ផ្សារថ្មី)', description: 'ផ្សារស្ទីល Art Deco ដែលសាងសង់នំ៣៧ មានរាងដូចក្បូរមានស្លាប ៤។ ជាបេះដូងនៃពាណិជ្ជកម្មភ្នំពេញ។', tips: 'តចរចាខ្លាំង — ចាប់ផ្តើមពី ៥០% នៃតម្លៃដែលគេសួរ។', address: 'ផ្លូវ១២៨ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Choeung Ek Killing Fields',
    lat: 11.4840, lng: 104.9018,
    category: 'museum',
    imageKey: 'places/places-4.jpg',
    entryFee: 6,
    openingHours: '08:00–17:30',
    dressCode: 'Respectful attire',
    translations: [
      { lang: 'en', name: 'Choeung Ek Killing Fields', description: 'A somber memorial to the victims of the Khmer Rouge regime, this site features a stupa filled with 8,000 human skulls and informative audio tours.', tips: 'Allow 1–2 hours. The audio guide is highly recommended. Dress respectfully.', address: 'Phnom Penh, Cambodia' },
      { lang: 'zh', name: '钟屋杀人场', description: '红色高棉政权受害者的庄严纪念地，这座遗址有一座佛塔，里面安放着8000个人类头骨，还有信息丰富的语音导览。', tips: '预留1-2小时。强烈推荐使用语音导览。穿着得体。', address: '柬埔寨金边' },
      { lang: 'km', name: 'វាលពិឃាតជើងឯក', description: 'សម្ណាក់ឧទ្ទិសដល់ជនរងគ្រោះនៃរបបខ្មែរក្រហម ទីតាំងនេះមានចេតិយដែលពោរពេញដោយមួករៀមមនុស្ស ៨០០០។', tips: 'ចាក់ពេល ១-២ ម៉ោង។ ការណែនាំសំឡេងត្រូវបានណែនាំយ៉ាងខ្លាំង។', address: 'ភ្នំពេញ ប្រទេសកម្ពុជា' },
    ],
  },
  {
    folder: 'Garden City Water Park',
    lat: 11.6210, lng: 104.8780,
    category: 'nature',
    imageKey: 'places/places-5.jpg',
    entryFee: 5,
    openingHours: '09:00–18:00',
    translations: [
      { lang: 'en', name: 'Garden City Water Park', description: 'A family-friendly water park on the outskirts of Phnom Penh with slides, wave pools, and lazy rivers — a popular weekend escape for locals.', tips: 'Bring your own swimwear and sunscreen. Weekdays are less crowded than weekends.', address: 'National Road 5, Phnom Penh' },
      { lang: 'zh', name: '花园城水上乐园', description: '位于金边郊区的家庭友好型水上乐园，有滑梯、波浪池和懒人河——是当地人周末的热门去处。', tips: '自带泳衣和防晒霜。工作日比周末人少。', address: '金边5号国道' },
      { lang: 'km', name: 'សួនទឹកហ្គាដិនស៊ីតី', description: 'សួនទឹកសម្រាប់គ្រួសារនៅជាយក្រុងភ្នំពេញ មានទឹករលក និងទន្លេអាស្រ័យ។', tips: 'នាំយកអាវហែលទឹក និងក្រែមការពារពន្លឺព្រះអាទិត្យ។', address: 'ផ្លូវជាតិលេខ៥ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Independence Monument',
    lat: 11.5560, lng: 104.9288,
    category: 'museum',
    imageKey: 'places/places-6.jpg',
    entryFee: 0,
    openingHours: 'Open 24 hours',
    translations: [
      { lang: 'en', name: 'Independence Monument', description: 'A 37-meter-high lotus-shaped stupa built in 1958 to commemorate Cambodia\'s independence from France. It is one of Phnom Penh\'s most recognizable landmarks.', tips: 'Beautifully illuminated at night. Visit in the evening when locals gather in the surrounding park.', address: 'Norodom Blvd, Phnom Penh' },
      { lang: 'zh', name: '独立纪念碑', description: '一座37米高的莲花形佛塔，建于1958年，纪念柬埔寨脱离法国独立。是金边最具辨识度的地标之一。', tips: '夜晚灯光璀璨。傍晚参观时当地人会聚集在周围公园。', address: '金边诺罗敦大道' },
      { lang: 'km', name: 'រូបសំណាកឯករាជ្យ', description: 'ចេតិយរាងផ្កាឈូកកម្ពស់៣៧ម៉ែត្រ សាងសង់ន១៩៥៨ ដើម្បីរំលឹកឯករាជ្យកម្ពុជាពីបារាំង។', tips: 'ស្រស់ស្អាតនៅពេលយប់។ ទស្សនាល្ងាចនៅពេលប្រជាជនប្រជុំគ្នាក្នុងឧទ្យាន។', address: 'មហាវិថីនរោត្តម ភ្នំពេញ' },
    ],
  },
  {
    folder: 'National Museum of Cambodia',
    lat: 11.5651, lng: 104.9288,
    category: 'museum',
    imageKey: 'places/places-7.jpg',
    entryFee: 10,
    openingHours: '08:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'National Museum of Cambodia', description: 'Housing the world\'s finest collection of Khmer art, this beautiful terracotta building showcases sculptures from the Angkor period and pre-Angkor eras.', tips: 'Combine with a visit to the Royal Palace next door. Allow 1–2 hours.', address: 'Street 13, Phnom Penh' },
      { lang: 'zh', name: '柬埔寨国家博物馆', description: '拥有世界上最精美的高棉艺术收藏，这座美丽的赤陶建筑展示了吴哥时期和吴哥前时代的雕塑。', tips: '与隔壁的皇宫一起参观。预留1-2小时。', address: '金边13街' },
      { lang: 'km', name: 'សារមន្ទីរជាតិកម្ពុជា', description: 'ដែលមានស្តុកសំណង់សិល្បៈខ្មែរល្អបំផុតនៅលើពិភពលោក។', tips: 'ចូលរួមជាមួយការទស្សនាវាលពិឃាតជើងឯកដែលស្ថិតនៅជិតខាង។', address: 'ផ្លូវ១៣ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Phnom Penh Railway Station',
    lat: 11.5711, lng: 104.9156,
    category: 'museum',
    imageKey: 'places/places-8.jpg',
    entryFee: 0,
    openingHours: '06:00–20:00',
    translations: [
      { lang: 'en', name: 'Phnom Penh Railway Station', description: 'A charming French colonial-era railway station with yellow walls and green trim. It serves domestic routes to Sihanoukville, Battambang, and Siem Reap.', tips: 'Check the current schedule — passenger rail service is limited. The building itself is a great photo subject.', address: 'Street 108, Phnom Penh' },
      { lang: 'zh', name: '金边火车站', description: '一座迷人的法式殖民时期火车站，黄色墙壁配绿色装饰。有前往西哈努克、马德望和暹粒的国内线路。', tips: '查看当前时刻表——客运铁路服务有限。建筑本身是很好的拍摄对象。', address: '金边108街' },
      { lang: 'km', name: 'ស្ថានីយរថភ្លើងភ្នំពេញ', description: 'ស្ថានីយរថភ្លើងសម័យអាណានិគមបារាំងដ៏ស្រស់ស្អាត ជញ្ជាំងពណ៌លឿង និងពណ៌បៃតង។', tips: 'ពិនិត្យកាលវិភាគ — សេវារថភ្លើងអ្នកដំណើរមានកម្រិត។', address: 'ផ្លូវ១០៨ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Royal Palace',
    lat: 11.5637, lng: 104.9310,
    category: 'museum',
    imageKey: 'places/places-9.jpg',
    entryFee: 10,
    openingHours: '08:00–11:00, 14:00–17:00',
    dressCode: 'Smart casual, no shorts',
    translations: [
      { lang: 'en', name: 'Royal Palace & Silver Pagoda', description: 'The official residence of the King of Cambodia, featuring the stunning Silver Pagoda with its floor covered in 5,000 silver tiles and the Emerald Buddha.', tips: 'Wear proper attire. Photography is restricted inside the Silver Pagoda.', address: 'Sothearos Blvd, Phnom Penh' },
      { lang: 'zh', name: '金边皇宫与银塔', description: '柬埔寨国王的官邸，拥有令人惊叹的银塔，其地板由5000块银砖铺成，还有翡翠佛。', tips: '穿着得体。银塔内禁止拍照。', address: '金边索蒂罗斯大道' },
      { lang: 'km', name: 'ព្រះបរមរាជវាំង និងវត្តព្រះកែវមរកត', description: 'ទីលំនៅផ្លូវការរបស់ព្រះមហាក្សត្រកម្ពុជា។', tips: 'ស្លៀកពាក់សមរម្យ។ ការថតរូបត្រូវបានហាមឃាត់នៅខាងក្នុងវត្តព្រះកែវមរកត។', address: 'មហាវិថីសុធារស ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Russian Market Toul Tom Poung',
    lat: 11.5409, lng: 104.9179,
    category: 'market',
    imageKey: 'places/places-10.jpg',
    entryFee: 0,
    openingHours: '07:00–17:30',
    translations: [
      { lang: 'en', name: 'Russian Market (Toul Tom Poung)', description: 'Named for its popularity with Soviet expats in the 1980s, this bustling market is the best place in Phnom Penh for handicrafts, silk, antiques, and bargain clothing.', tips: 'Bargain aggressively. The back sections have the best handicrafts and art stalls.', address: 'Street 155, Phnom Penh' },
      { lang: 'zh', name: '俄罗斯市场（吐汤姆蓬）', description: '因1980年代苏联外派人员常去而得名，这个热闹的市场是金边购买手工艺品、丝绸、古董和便宜服装的最佳地点。', tips: '积极还价。后面区域有最好的手工艺品和艺术品摊位。', address: '金边155街' },
      { lang: 'km', name: 'ផ្សាររុស្សី (ទួលទំពូង)', description: 'ឈ្មោះត្រូវបានដាក់ដោយសារប្រជាប្រិយជាមួយជនអន្តរជាតិសូវៀតក្នុងទសវត្សរ៍ទី១៩៨០។', tips: 'តចរចាខ្លាំង។ ផ្នែកខាងក្រោយមានទំនិញសិល្បៈល្អបំផុត។', address: 'ផ្លូវ១៥៥ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Silver Pagoda',
    lat: 11.5620, lng: 104.9318,
    category: 'temple',
    imageKey: 'places/places-11.jpg',
    entryFee: 10,
    openingHours: '08:00–11:00, 14:00–17:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Silver Pagoda', description: 'Located within the Royal Palace compound, this temple is famous for its floor of over 5,000 silver tiles and houses many national treasures including the Emerald Buddha and a diamond-encrusted Buddha.', tips: 'Entry is included with Royal Palace admission. No photography inside.', address: 'Royal Palace Compound, Phnom Penh' },
      { lang: 'zh', name: '银塔', description: '位于皇宫建筑群内，这座寺庙以其5000多块银砖铺成的地板而闻名，收藏了许多国宝，包括翡翠佛和钻石镶嵌佛。', tips: '门票包含在皇宫门票内。内部禁止拍照。', address: '金边皇宫建筑群内' },
      { lang: 'km', name: 'វត្តព្រះកែវមរកត', description: 'ស្ថិតនៅក្នុងកន្លែងព្រះបរមរាជវាំង ល្បីល្បាញដោយក្បាលបាតដែលគ្របដណ្តប់ដោយក្រដាសប្រាក់ច្រើនជាង ៥០០០។', tips: 'ការចូលរួមរួមបញ្ចូលក្នុងវិក្កប័ត្រចូលព្រះបរមរាជវាំង។', address: 'កន្លែងព្រះបរមរាជវាំង ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Sisowath Quay',
    lat: 11.5700, lng: 104.9320,
    category: 'nature',
    imageKey: 'places/places-12.jpg',
    entryFee: 0,
    openingHours: 'Open 24 hours',
    translations: [
      { lang: 'en', name: 'Sisowath Quay', description: 'The vibrant riverside promenade along the Tonle Sap and Mekong rivers. Lined with restaurants, bars, cafes, and hotels, it is the social heart of Phnom Penh.', tips: 'Best at sunset. Take a stroll and grab a drink at one of the many riverfront bars.', address: 'Sisowath Quay, Phnom Penh' },
      { lang: 'zh', name: '西索维码头', description: '沿洞里萨河和湄公河的活力河滨步道。两旁遍布餐厅、酒吧、咖啡馆和酒店，是金边的社交中心。', tips: '日落时分最美。散步并在众多河滨酒吧中找一家喝一杯。', address: '金边西索维码头' },
      { lang: 'km', name: 'តំបាំងស៊ីសុវត្ថិ', description: 'ផ្លូវដើរតាមដងទន្លេសាប និងទន្លេមេគង្គ។ មានភោជនីយដ្ឋាន បារ កាហ្វេ និងសណ្ឋាគារ។', tips: 'ល្អបំផុតនៅពេលថ្ងៃលិច។ ដើរលេង និងផឹកនៅបារតាមដងទន្លេ។', address: 'តំបាំងស៊ីសុវត្ថិ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Tuol Sleng Genocide Museum',
    lat: 11.5494, lng: 104.9177,
    category: 'museum',
    imageKey: 'places/places-13.jpg',
    entryFee: 5,
    openingHours: '08:00–17:00',
    dressCode: 'Respectful attire',
    translations: [
      { lang: 'en', name: 'Tuol Sleng Genocide Museum', description: 'A former high school turned into Security Prison 21 (S-21) by the Khmer Rouge. It now serves as a memorial and museum documenting the atrocities of the regime.', tips: 'Allow 1–2 hours. The experience is deeply moving. Audio guide recommended.', address: 'Street 113, Phnom Penh' },
      { lang: 'zh', name: '吐斯廉屠杀博物馆', description: '一所被红色高棉改为S-21监狱的前高中。现在作为纪念博物馆，记录该政权的暴行。', tips: '预留1-2小时。体验令人深感震撼。推荐使用语音导览。', address: '金边113街' },
      { lang: 'km', name: 'សារមន្ទីរប្រល័យពូជសាសន៍ទួលស្លែង', description: 'អតីតរៀនវិទ្យាល័យដែលត្រូវបានប្រែជាគុកសន្តិសុខ ២១ (S-21) ដោយខ្មែរក្រហម។', tips: 'ចាក់ពេល ១-២ ម៉ោង។ បទពិសោធន៍ចាប់អារម្មណ៏ជ្រាលជ្រៅ។', address: 'ផ្លូវ១១៣ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Wat Botum',
    lat: 11.5577, lng: 104.9298,
    category: 'temple',
    imageKey: 'places/places-14.jpg',
    entryFee: 0,
    openingHours: '07:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Wat Botum', description: 'One of Phnom Penh\'s five original temples, Wat Botum is a working monastery surrounded by a peaceful park. It is a center for Buddhist learning and culture.', tips: 'Visit in the morning to see monks at prayer. The surrounding park is a quiet escape from the city bustle.', address: 'Wat Phnom Commune, Phnom Penh' },
      { lang: 'zh', name: '塔山寺', description: '金边五座原始寺庙之一，塔山寺是一座被宁静公园环绕的修行寺院。它是佛教学习和文化的中心。', tips: '早上参观可以看到僧侣祈祷。周围的公园是远离城市喧嚣的安静去处。', address: '金边塔山寺区' },
      { lang: 'km', name: 'វត្តបទុម', description: 'មួយក្នុងចំណោមវត្តដើម៣នៃភ្នំពេញ វត្តបទុមជាវត្តដែលព័ទ្ធជុំវិញដោយឧទ្យានស្ងប់ស្ងាត់។', tips: 'ទស្សនាពេលព្រឹកដើម្បីមើលព្រះសង្ឃកំពុងបួស។', address: 'ឃុំវត្តភ្នំ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Wat Ounalom',
    lat: 11.5690, lng: 104.9305,
    category: 'temple',
    imageKey: 'places/places-15.jpg',
    entryFee: 0,
    openingHours: '07:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Wat Ounalom', description: 'The headquarters of Cambodian Buddhism and the most important temple in Phnom Penh. It houses a sacred relic of Buddha (a hair from his eyebrow) and has been a center of Buddhist learning for centuries.', tips: 'Dress modestly. The main stupa contains the sacred Buddha relic.', address: 'Sisowath Quay, Phnom Penh' },
      { lang: 'zh', name: '乌那隆寺', description: '柬埔寨佛教的总部和金边最重要的寺庙。内藏有佛陀圣物（眉毛上的一根头发），几个世纪以来一直是佛教学习的中心。', tips: '穿着得体。主佛塔内藏有佛陀圣物。', address: '金边西索维码头' },
      { lang: 'km', name: 'វត្តឧណ្ណោលោម', description: 'ទីស្នាក់ការកណ្តាលនៃព្រះពុទ្ធសាសនាកម្ពុជា និងវត្តសំខាន់បំផុតនៅភ្នំពេញ។', tips: 'ស្លៀកពាក់សមរម្យ។ ចេតិយមេមានអារក្សព្រះពុទ្ធ។', address: 'តំបាំងស៊ីសុវត្ថិ ភ្នំពេញ' },
    ],
  },
  {
    folder: 'Wat Phnom',
    lat: 11.5764, lng: 104.9171,
    category: 'temple',
    imageKey: 'places/places-16.jpg',
    entryFee: 1,
    openingHours: '07:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Wat Phnom', description: 'The legendary founding temple of Phnom Penh, built in 1372 on a small hill. According to legend, Lady Penh discovered Buddha statues in a floating tree and built the temple to house them.', tips: 'Climb the stairs to the top for a nice view. Fortune tellers operate near the entrance.', address: 'Street 96, Phnom Penh' },
      { lang: 'zh', name: '塔山寺', description: '金边传说中的建城寺庙，建于1372年的一座小山上。根据传说，边夫人在漂浮的树中发现了佛像并建造了寺庙来供奉它们。', tips: '爬上楼梯到顶部可以看到不错的风景。入口附近有算命先生。', address: '金边96街' },
      { lang: 'km', name: 'វត្តភ្នំ', description: 'វត្តបង្កើតក្រុងភ្នំពេញដំបូង សាងសង់ន១៣៧២ នៅលើភ្នំតូចមួយ។ យោងតាមរឿងព្រេង នាងពេញបានរកឃើញរូបព្រះពុទ្ធក្នុងដើមឈើអណ្តែត។', tips: 'ឡើងជណ្តើរដើម្បីមើលទិដ្ឋភាពស្រស់ស្អាត។', address: 'ផ្លូវ៩៦ ភ្នំពេញ' },
    ],
  },

  // ============================================================
  // SIEM REAP
  // ============================================================
  {
    folder: 'Angkor National Museum',
    lat: 13.3637, lng: 103.8556,
    category: 'museum',
    imageKey: 'places/places-17.jpg',
    entryFee: 12,
    openingHours: '08:30–18:00',
    dressCode: 'Smart casual',
    translations: [
      { lang: 'en', name: 'Angkor National Museum', description: 'A world-class museum that tells the story of the Angkor Empire through galleries of artifacts, multimedia displays, and immersive exhibits. A great primer before visiting the temples.', tips: 'Start here before visiting the temples for context. Allow 2 hours. Audio guide included.', address: 'Charles de Gaulle Blvd, Siem Reap' },
      { lang: 'zh', name: '吴哥国家博物馆', description: '一座世界级博物馆，通过文物画廊、多媒体展示和沉浸式展览讲述吴哥帝国的故事。参观寺庙前很好的入门。', tips: '参观寺庙前先来这里了解背景。预留2小时。包含语音导览。', address: '暹粒戴高乐大道' },
      { lang: 'km', name: 'សារមន្ទីរជាតិអង្គរ', description: 'សារមន្ទីរល្បីល្បាញដែលប្រាប់រឿងអាណានិគមអង្គរតាមរយៈវិចិត្រសាល។', tips: 'ចាប់ផ្តើមទីនេះមុនទស្សនាប្រាសាទដើម្បីយល់ពីបរិបទ។', address: 'មហាវិថីឆាល់ដឺហ្គែល សៀមរាប' },
    ],
  },
  {
    folder: 'Angkor Thom',
    lat: 13.4244, lng: 103.8587,
    category: 'temple',
    imageKey: 'places/places-18.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Angkor Thom (South Gate)', description: 'The last great capital of the Angkor Empire, enclosed by 8-meter-high walls and a moat. The South Gate is approached via a causeway lined with 54 gods and 54 demons.', tips: 'The Bayon temple is at the center of Angkor Thom. Enter via the South Gate for the most dramatic approach.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '吴哥通（南门）', description: '吴哥帝国最后一座伟大的首都，被8米高的城墙和护城河环绕。南门通过一条两侧排列着54尊神像和54尊恶魔雕像的堤道接近。', tips: '巴戎寺位于吴哥通的中心。从南门进入体验最壮观的入场。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'អង្គរធំ (ទ្វារខាងត្បូង)', description: 'រាជធានីធំចុងក្រោយនៃអាណានិគមអង្គរ ដែលមានជញ្ជាំងកម្ពស់៨ម៉ែត្រ។', tips: 'ប្រាសាទបាយ័នស្ថិតនៅកណ្តាលអង្គរធំ។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Angkor Wat',
    lat: 13.4125, lng: 103.8670,
    category: 'temple',
    imageKey: 'places/places-19.jpg',
    entryFee: 37,
    openingHours: '05:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Angkor Wat', description: 'The largest religious monument in the world, this 12th-century temple complex is the crown jewel of Khmer architecture and a symbol of Cambodia.', tips: 'Arrive at sunrise for the best photos. Hire a licensed guide to learn the history.', address: 'Siem Reap, Cambodia' },
      { lang: 'zh', name: '吴哥窟', description: '世界上最大的宗教建筑，这座12世纪的寺庙建筑群是高棉建筑的瑰宝，也是柬埔寨的象征。', tips: '建议日出时抵达，拍照效果最佳。聘请持证导游了解历史。', address: '柬埔寨暹粒省' },
      { lang: 'km', name: 'អង្គរវត្ត', description: 'ប្រាសាទសាសនាធំជាងគេបំផុតនៅលើពិភពលោក។', tips: 'មកដល់ពេលថ្ងៃរះដើម្បីថតរូបល្អបំផុត។', address: 'ខេត្តសៀមរាប ប្រទេសកម្ពុជា' },
    ],
  },
  {
    folder: 'Banteay Kdei',
    lat: 13.4316, lng: 103.8902,
    category: 'temple',
    imageKey: 'places/places-20.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Banteay Kdei', description: 'A Buddhist monastery temple built in the late 12th century, similar in plan to Ta Prohm but less overgrown. Its galleries and courtyards offer a serene, less-visited alternative.', tips: 'Much less crowded than Ta Prohm. Combine with a visit to nearby Srah Srang reservoir.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '班提色寺', description: '一座建于12世纪末的佛教寺院，布局与塔布茏寺相似但较少被植被覆盖。其画廊和庭院提供了宁静、游客较少的替代选择。', tips: '比塔布茏寺人少得多。可与附近的斯拉萨兰水库一起参观。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ប្រាសាទបន្ទាយក្តី', description: 'វត្តព្រះពុទ្ធសាសនាដែលសាងសង់នៅចុងទសវត្សរ៍ទី១២ ស្រដៀងនឹងតាព្រហ្មប៉ុន្តែមានជំរុះតិចជាង។', tips: 'មនុស្សតិចជាងតាព្រហ្មណាស់។ ចូលរួមជាមួយស្រះស្រង់នៅជិតខាង។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Banteay Samre',
    lat: 13.4480, lng: 103.9233,
    category: 'temple',
    imageKey: 'places/places-21.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Banteay Samre', description: 'A compact, well-preserved temple built in the 12th century, known for its high quality sandstone carvings and peaceful setting away from the main tourist trail.', tips: 'One of the most underrated temples. The carvings are exceptionally fine. Very few crowds.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '班提萨姆寺', description: '一座紧凑、保存完好的12世纪寺庙，以其高质量的砂岩雕刻和远离主要旅游路线的宁静环境而闻名。', tips: '最被低估的寺庙之一。雕刻异常精美。几乎没有人群。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ប្រាសាទបន្ទាយសំរែ', description: 'ប្រាសាទតូចដែលរក្សាទុកល្អ សាងសង់ន១២ ល្បីល្បាញដោយចម្លាក់ថ្មប្រាក់គុណភាពខ្ពស់។', tips: 'មួយក្នុងចំណោមប្រាសាទដែលមិនសូវគិតថាល្អ។ ចម្លាក់ឆ្លាតវៃណាស់។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Banteay Srei',
    lat: 13.5990, lng: 103.9633,
    category: 'temple',
    imageKey: 'places/places-22.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Banteay Srei', description: 'Known as the "Citadel of Women," this 10th-century temple is carved from pink sandstone and features the most exquisite bas-reliefs in all of Angkor — often considered the finest example of classical Khmer art.', tips: 'Located 25km from Siem Reap. Visit in the morning for the best light on the pink stone. Allow half a day.', address: 'Banteay Srei, Siem Reap' },
      { lang: 'zh', name: '女王宫', description: '被称为"女人的城堡"，这座10世纪寺庙由粉红色砂岩雕刻而成，拥有吴哥最精美的浮雕——被认为是古典高棉艺术的最佳典范。', tips: '位于暹粒25公里外。早上参观粉红色石头上的光线最美。预留半天。', address: '暹粒女王宫' },
      { lang: 'km', name: 'ប្រាសាទបន្ទាយស្រី', description: 'ត្រូវបានស្គាល់ថាជា "បន្ទាយស្ត្រី" ប្រាសាទសតវត្សទី១០នេះឆ្លាក់ពីថ្មប្រាក់ពណ៌ផ្កាឈូក។', tips: 'ស្ថិតនៅ២៥គីឡូម៉ែត្�រពីសៀមរាប។ ទស្សនាពេលព្រឹកសម្រាប់ពន្លឺល្អបំផុតលើថ្មពណ៌ផ្កាឈូក។', address: 'បន្ទាយស្រី សៀមរាប' },
    ],
  },
  {
    folder: 'Baphuon',
    lat: 13.4419, lng: 103.8573,
    category: 'temple',
    imageKey: 'places/places-23.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Baphuon', description: 'A massive three-tiered temple mountain representing Mount Meru, built in the 11th century. Its most striking feature is a 70-meter-long reclining Buddha on the western face.', tips: 'Climb the steep stairs for panoramic views. The reclining Buddha is hidden on the west side.', address: 'Angkor Thom, Siem Reap' },
      { lang: 'zh', name: '巴芳寺', description: '一座代表须弥山的三层巨型寺庙山，建于11世纪。最引人注目的是西面上70米长的卧佛。', tips: '爬上陡峭的楼梯可欣赏全景。卧佛隐藏在西侧。', address: '暹粒吴哥通' },
      { lang: 'km', name: 'ប្រាសាទបាពួន', description: 'ប្រាសាទភ្នំ៣ជាន់ដ៏ធំតំណាងឱ្យភ្នំមេរុ សាងសង់ន១១។', tips: 'ឡើងជណ្តើរក្រាស់សម្រាប់ទិដ្ឋភាពទូលាយ។ ព្រះពុទ្ធសម្តេចដេកនៅខាងលិច។', address: 'អង្គរធំ សៀមរាប' },
    ],
  },
  {
    folder: 'Bayon Temple',
    lat: 13.4413, lng: 103.8590,
    category: 'temple',
    imageKey: 'places/places-24.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Bayon Temple', description: 'Famous for its 216 serene stone faces carved into towering pillars, Bayon sits at the heart of Angkor Thom and represents the intersection of Buddhism and Hinduism.', tips: 'Visit in the morning light when the stone faces glow. Look for the bas-reliefs depicting daily Khmer life.', address: 'Angkor Thom, Siem Reap' },
      { lang: 'zh', name: '巴戎寺', description: '以其216座雕刻在高耸石柱上的宁静石脸而闻名，巴戎寺位于吴哥通王城的中心，代表着佛教与印度教的交汇。', tips: '早晨光线照射时石脸会发光，此时参观最佳。寻找描绘高棉日常生活的浮雕。', address: '暹粒吴哥通王城' },
      { lang: 'km', name: 'ប្រាសាទបាយ័ន', description: 'ល្បីល្បាញដោយមុខថ្មសន្តិភាព ២១៦ ដែលឆ្លាក់លើជញ្ជឹងខ្ពស់។', tips: 'មកពេលព្រឹកពន្លូញពន្លឺព្រះអាទិត្យលាតសន្ធឹងលើមុខថ្ម។', address: 'អង្គរធំ សៀមរាប' },
    ],
  },
  {
    folder: 'Beng Mealea',
    lat: 13.4744, lng: 104.2310,
    category: 'temple',
    imageKey: 'places/places-25.jpg',
    entryFee: 5,
    openingHours: '07:00–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Beng Mealea', description: 'A sprawling jungle temple complex covering over a hectare, often called a "mini Angkor Wat." Fallen stones and massive trees create an adventurous, lost-world atmosphere.', tips: 'Located 40km east of Siem Reap. Bring water and wear sturdy shoes. The adventurous will love exploring the collapsed galleries.', address: 'Beng Mealea, Siem Reap' },
      { lang: 'zh', name: '崩密列', description: '一座占地超过一公顷的广阔丛林寺庙群，常被称为"小吴哥"。倒下的石头和巨大的树木营造出冒险的失落世界氛围。', tips: '位于暹粒以东40公里。带水和穿结实的鞋子。喜欢冒险的人会喜欢探索坍塌的画廊。', address: '暹粒崩密列' },
      { lang: 'km', name: 'បឹងមាលា', description: 'ប្រាសាទព្រៃដ៏ធំលាតសន្ធឹងលើមួយហិកតា ជាញឹកញាប់ត្រូវបានគេហៅថា "អង្គរវត្តតូច"។', tips: 'ស្ថិតន០គីឡូម៉ែត្រភាគឦសាននៃសៀមរាប៓។ នាំយកទឹក និងស្បែកជើងរឹងមាំ។', address: 'បឹងមាលា សៀមរាប' },
    ],
  },
  {
    folder: 'East Mebon',
    lat: 13.4427, lng: 103.9224,
    category: 'temple',
    imageKey: 'places/places-26.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'East Mebon', description: 'A 10th-century temple mountain built on an artificial island in the middle of the now-dry East Baray reservoir. It features large stone elephant statues at its corners.', tips: 'The corner elephants are the highlight. Combine with a visit to nearby Banteay Samre.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '东梅奔寺', description: '一座10世纪寺庙山，建在现已干涸的东巴莱水库中的人工岛上。角落有大型石象雕像。', tips: '角落的大象是亮点。可与附近的班提萨姆寺一起参观。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'មេបុណ្យខាងកើត', description: 'ប្រាសាទភ្នំសតវត្សទី១០សាងសង់នៅលើកោះសិប្បកម្មកណ្តាលបឹងទឹកកើតដែលឥឡូវបានស្ងួត។', tips: 'ដំរីជ្រុងជាចំណុចសំខាន់។ ចូលរួមជាមួយបន្ទាយសំរែនៅជិតខាង។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Kampong Phluk Floating Village',
    lat: 13.2030, lng: 104.0150,
    category: 'nature',
    imageKey: 'places/places-27.jpg',
    entryFee: 20,
    openingHours: '07:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'Kampong Phluk Floating Village', description: 'A stilted village on the floodplains of Tonle Sap Lake where houses can rise 10 meters above ground during the wet season. Experience life on the water with boat tours through flooded forests.', tips: 'Best during wet season (Jun–Nov) when you can boat through the flooded forest. Hire a local guide at the boat dock.', address: 'Tonle Sap Lake, Siem Reap' },
      { lang: 'zh', name: '贡普卢克浮村', description: '洞里萨湖洪泛区的高脚屋村庄，雨季时房屋可高出地面10米。乘船穿越被淹没的森林体验水上生活。', tips: '雨季（6月至11月）最佳，可以乘船穿越被淹没的森林。在码头雇当地导游。', address: '暹粒洞里萨湖' },
      { lang: 'km', name: 'ភូមិអណ្តែតកំពង់ភ្លុក', description: 'ភូមិលើសសរនៅវាលទឹកជំនន់បឹងទន្លេសាប ផ្ទះអាចខ្ពស់១០ម៉ែត្រក្នុងរដូវវស្សា។', tips: 'ល្អបំផុតក្នុងរដូវវស្សា (មិថុនា–វិច្ឆិកា)។ ជួលមគ្គុទេសក៍ក្នុងស្រុកនៅច្រនៈទូក។', address: 'បឹងទន្លេសាប សៀមរាប' },
    ],
  },
  {
    folder: 'Kbal Spean',
    lat: 13.6583, lng: 104.0540,
    category: 'nature',
    imageKey: 'places/places-28.jpg',
    entryFee: 10,
    openingHours: '08:00–17:00',
    dressCode: 'Outdoor gear',
    translations: [
      { lang: 'en', name: 'Kbal Spean', description: 'Known as the "Valley of a Thousand Lingas," this archaeological site in the jungle features Hindu carvings etched into the riverbed. A 45-minute jungle hike leads to the site.', tips: 'Wear good hiking shoes. The trail is steep and can be slippery. Best after recent rain when the carvings are clear.', address: 'Phnom Kulen area, Siem Reap' },
      { lang: 'zh', name: '克比斯班', description: '被称为"千林伽之谷"，这个丛林考古遗址有蚀刻在河床上的印度教雕刻。45分钟的丛林徒步到达遗址。', tips: '穿好登山鞋。小径陡峭且可能湿滑。雨后雕刻最清晰时最佳。', address: '暹粒荔枝山地区' },
      { lang: 'km', name: 'ក្បាលស្ពាន', description: 'ត្រូវបានស្គាល់ថាជា "ជ្រលងមហាក់ខណ្ឌពាន់លិង្គ" ទីតាំងបុរាណវិទ្យានេះមានចម្លាក់ហិណ្ឌូនៅក្បាលទន្លេ។', tips: 'ស្បែកជើងដើរព្រៃល្អ។ ផ្លូវក្រាស់ និងអាចរអិល។', address: 'តំបឋ់ភ្នំគូលែន សៀមរាប' },
    ],
  },
  {
    folder: 'Neak Pean',
    lat: 13.4636, lng: 103.8945,
    category: 'temple',
    imageKey: 'places/places-29.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Neak Pean', description: 'A small but beautiful temple set on an island in the middle of the Preah Khan baray (reservoir). It features a central pool surrounded by four smaller pools, representing the sacred lake Anavatapta.', tips: 'Best photographed from the walkway. The setting is especially atmospheric in the late afternoon.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '涅盘寺', description: '一座小而美丽的寺庙，位于Preah Khan巴莱（水库）中央的岛屿上。中央水池被四个较小的水池环绕，代表圣湖阿那婆达多。', tips: '从走道拍摄最佳。傍晚时分环境特别有氛围。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'នាគពាន់', description: 'ប្រាសាទតូចប៉ុន្តែស្រស់ស្អាតនៅលើកោះកណ្តាលបឹងព្រះខាន់។', tips: 'ថតរូបល្អបំផុតពីផ្លូវដើរ។ បរិយាកាសពិសេសនៅពេលល្ងាច។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Old Market Psar Chaa',
    lat: 13.3530, lng: 103.8555,
    category: 'market',
    imageKey: 'places/places-30.jpg',
    entryFee: 0,
    openingHours: '06:00–18:00',
    translations: [
      { lang: 'en', name: 'Old Market (Psar Chaa)', description: 'The heart of Siem Reap\'s local commerce, this bustling market offers fresh produce, fish, meat, spices, and street food. It is where locals actually shop.', tips: 'Go early morning for the most authentic experience. Try the local breakfast stalls inside.', address: 'Wat Bo Road, Siem Reap' },
      { lang: 'zh', name: '老市场（查尔市场）', description: '暹粒本地商业的核心，这个热闹的市场提供新鲜农产品、鱼、肉、香料和街头美食。这是当地人真正购物的地方。', tips: '清晨前往体验最地道的风情。尝试里面的当地早餐摊位。', address: '暹粒瓦博路' },
      { lang: 'km', name: 'ផ្សារចាស់ (ផ្សារឆា)', description: 'បេះដូងនៃពាណិជ្ជកម្មក្នុងស្រុកសៀមរាប ផ្សារនេះមានផ្លែឈើ ត្រី សាច់ គ្រឿងទេស និងម្ហូបផ្លូវថ្នល់។', tips: 'ទៅពេលព្រឹកព្រលឹមសម្រាប់បទពិសោធន៍ដើមត្រឹមត្រូវ។', address: 'ផ្លូវវត្តបុ សៀមរាប' },
    ],
  },
  {
    folder: 'Phnom Bakheng',
    lat: 13.4239, lng: 103.8567,
    category: 'temple',
    imageKey: 'places/places-1.jpg',
    entryFee: 37,
    openingHours: '05:00–19:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Phnom Bakheng', description: 'A hilltop temple offering the most popular sunset view over Angkor Wat. Built in the 9th century, it is one of the oldest temples in the Angkor region.', tips: 'Arrive early for sunset — crowds are large. Limited entries at peak times. The view of Angkor Wat at dusk is spectacular.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '巴肯山', description: '一座山顶寺庙，提供最受欢迎的吴哥窟日落景观。建于9世纪，是吴哥地区最古老的寺庙之一。', tips: '早点到看日落——人很多。高峰期有人数限制。黄昏时分的吴哥窟景色壮观。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ភ្នំបាខែង', description: 'ប្រាសាទលើកំពូលភ្នំដែលផ្តល់ទិដ្ឋភាពថ្ងៃលិចលើអង្គរវត្តដ៏ពេញនិយមបំផុត។', tips: 'មកមុនសម្រាប់ថ្ងៃលិច — មនុស្សច្រើន។ ទិដ្ឋភាពអង្គរវត្តពេលល្ងាចគួរឱ្យភ្ញាក់ផ្អើល។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Phnom Kulen',
    lat: 13.5790, lng: 104.1340,
    category: 'mountain',
    imageKey: 'places/places-2.jpg',
    entryFee: 20,
    openingHours: '07:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'Phnom Kulen', description: 'A sacred mountain plateau considered the birthplace of the Khmer Empire. It features waterfalls, a reclining Buddha carved into a boulder, and the river of a thousand lingas at Kbal Spean.', tips: 'A full-day trip from Siem Reap. Bring swimwear for the waterfalls. The road is steep but paved.', address: 'Phnom Kulen National Park, Siem Reap' },
      { lang: 'zh', name: '荔枝山', description: '一座神圣的高原，被认为是高棉帝国的发源地。有瀑布、雕刻在巨石上的卧佛，以及克比斯班的千林伽河。', tips: '从暹粒出发的一日游。带泳衣去瀑布。道路陡峭但已铺砌。', address: '暹粒荔枝山国家公园' },
      { lang: 'km', name: 'ភ្នំគូលែន', description: 'ទីកន្លែងបរិសុទ្ធដែលចាត់ទុកថាជាទីកន្លែងកំណើតអាណានិគមខ្មែរ។ មានទឹកធ្លាក់ ព្រះពុទ្ធសម្តេចដេកឆ្លាក់លើថ្ម។', tips: 'ដំណើរមួយថ្ងៃពីសៀមរាប។ នាំយកអាវហែលទឹកសម្រាប់ទឹកធ្លាក់។', address: 'ឧទ្យានជាតិភ្នំគូលែន សៀមរាប' },
    ],
  },
  {
    folder: 'Preah Khan',
    lat: 13.4602, lng: 103.8730,
    category: 'temple',
    imageKey: 'places/places-3.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Preah Khan', description: 'A vast 12th-century monastic complex that was once a Buddhist university and home to 100,000 people. Its labyrinthine corridors and tree-strangled gates create an atmospheric, adventurous feel.', tips: 'Allow at least 2 hours. The central sanctuary has a mystical atmosphere. Combine with Neak Pean nearby.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '圣剑寺', description: '一座广阔的12世纪修道院群，曾是一所佛教大学，有10万人居住。其迷宫般的走廊和树根缠绕的大门营造出神秘冒险的氛围。', tips: '预留至少2小时。中央圣所有神秘氛围。可与附近的涅盘寺一起参观。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ព្រះខាន់', description: 'ប្រាសាទព្រះពុទ្ធសាសនាធំន១២ ដែលធ្លាប់ជាសាកលវិទ្យាល័យព្រះពុទ្ធសាសនា និងជាផ្ទះរបស់១០០០០០នាក់។', tips: 'ចាក់ពេលយ៉ាងហោចណាស់២ម៉ោង។ ទីបរិសុទ្ធកណ្តាលមានបរិយាកាសអាថ៌កំបាំង។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Pre Rup',
    lat: 13.4350, lng: 103.9320,
    category: 'temple',
    imageKey: 'places/places-4.jpg',
    entryFee: 37,
    openingHours: '05:00–18:00',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Pre Rup', description: 'A 10th-century temple mountain built of brick, laterite, and sandstone. Its stepped pyramid form and elevated platform make it a popular spot for sunrise and sunset views.', tips: 'Popular for sunrise. The top platform offers panoramic views of the surrounding countryside.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '比粒寺', description: '一座10世纪寺庙山，由砖、红土和砂岩建成。其阶梯金字塔形式和高层平台使其成为观赏日出日落的热门地点。', tips: '日出热门地点。顶层平台可欣赏周围乡村的全景。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ព្រះរូប', description: 'ប្រាសាទភ្នំសតវត្សទី១០សាងសង់ពីឥដ្ឋ លីត និងថ្មប្រាក់។', tips: 'ពេញនិយមសម្រាប់ថ្ងៃរះ។ កម្រិតខ្ពស់ផ្តល់ទិដ្ឋភាពទូលាយ។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Pub Street',
    lat: 13.3548, lng: 103.8551,
    category: 'market',
    imageKey: 'places/places-5.jpg',
    entryFee: 0,
    openingHours: '17:00–04:00',
    translations: [
      { lang: 'en', name: 'Pub Street', description: 'The nightlife heart of Siem Reap, this pedestrian street is packed with bars, restaurants, street food stalls, and live music venues. It comes alive after dark.', tips: 'Go after 8pm for the full experience. Try the famous fish foot massage at one of the tanks along the street.', address: 'Pub Street, Siem Reap' },
      { lang: 'zh', name: '酒吧街', description: '暹粒夜生活的中心，这条步行街挤满了酒吧、餐厅、街头美食摊位和现场音乐场所。天黑后热闹非凡。', tips: '晚上8点后去体验完整氛围。尝试街上鱼疗池的著名鱼疗按摩。', address: '暹粒酒吧街' },
      { lang: 'km', name: 'ផ្លូវបារ', description: 'បេះដូងនៃជីវិតយប់សៀមរាប ផ្លូវថ្នល់នេះពេញទៅដោយបារ ភោជនីយដ្ឋាន និងម្ហូបផ្លូវថ្នល់។', tips: 'ទៅបន្ទាប់ពីម៉ោង៨យប់សម្រាប់បទពិសោធន៍ពេញលេញ។', address: 'ផ្លូវបារ សៀមរាប' },
    ],
  },
  {
    folder: 'Srah Srang',
    lat: 13.4290, lng: 103.8930,
    category: 'nature',
    imageKey: 'places/places-6.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'Srah Srang', description: 'A serene royal reservoir (baray) with a picturesque stone platform overlooking the water. It is a peaceful spot for sunrise, far from the main temple crowds.', tips: 'Beautiful at sunrise. Combine with nearby Banteay Kdei temple. Bring a camera for reflections.', address: 'Angkor Archaeological Park, Siem Reap' },
      { lang: 'zh', name: '斯拉萨兰', description: '一座宁静的皇家水库（巴莱），有一个俯瞰水面的如画石台。是远离主要寺庙人群的宁静日出点。', tips: '日出时很美。可与附近的班提色寺一起参观。带相机拍倒影。', address: '暹粒吴哥考古公园' },
      { lang: 'km', name: 'ស្រះស្រង់', description: 'អាងទឹករាជវាំងស្ងប់ស្ងាត់ជាមួយកម្រិតថ្មស្រស់ស្អាតមើលទឹក។', tips: 'ស្រស់ស្អាតនៅពេលថ្ងៃរះ។ ចូលរួមជាមួយបន្ទាយក្តីនៅជិតខាង។', address: 'ឧទ្យានបុរាណវិទ្យាអង្គរ សៀមរាប' },
    ],
  },
  {
    folder: 'Ta Prohm',
    lat: 13.4348, lng: 103.8891,
    category: 'temple',
    imageKey: 'places/places-7.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Ta Prohm', description: 'Known as the "Tomb Raider temple," this mystical ruin has been swallowed by the jungle, with massive tree roots entwining ancient stone walls.', tips: 'Go early to avoid crowds. The giant spung trees are most photogenic in soft morning light.', address: 'Siem Reap, Cambodia' },
      { lang: 'zh', name: '塔布茏寺', description: '被称为"古墓丽影寺"，这座神秘的废墟已被丛林吞噬，巨大的树根缠绕着古老的石墙。', tips: '早点去避开人群。巨大的榕树在柔和的晨光中最适合拍照。', address: '柬埔寨暹粒' },
      { lang: 'km', name: 'ប្រាសាទតាព្រហ្ម', description: 'ដែលត្រូវបានស្គាល់ថាជា "ប្រាសាទ Tomb Raider"។', tips: 'ទៅមុនដើម្បីជៀសវាងចំនួនមនុស្សច្រើន។', address: 'សៀមរាប ប្រទេសកម្ពុជា' },
    ],
  },
  {
    folder: 'Terrace of the Elephants',
    lat: 13.4458, lng: 103.8588,
    category: 'temple',
    imageKey: 'places/places-8.jpg',
    entryFee: 37,
    openingHours: '07:30–17:30',
    dressCode: 'Cover shoulders and knees',
    translations: [
      { lang: 'en', name: 'Terrace of the Elephants', description: 'A 350-meter-long terrace with elaborate elephant carvings, used as a viewing platform for royal ceremonies and public declarations in Angkor Thom.', tips: 'The best carvings are at the central section. Combine with the nearby Terrace of the Leper King.', address: 'Angkor Thom, Siem Reap' },
      { lang: 'zh', name: '象台', description: '一座350米长的露台，有精美的大象雕刻，用作吴哥通皇家仪式和公开宣言的观礼台。', tips: '最好的雕刻在中央部分。可与附近的麻风王台一起参观。', address: '暹粒吴哥通' },
      { lang: 'km', name: 'ទីលានដំរី', description: 'ទីលានវែង៣៥០ម៉ែត្រមានចម្លាក់ដំរីស្មុគស្មាញ ប្រើជាកម្រិតមើលពិធីការរាជវាំង។', tips: 'ចម្លាក់ល្អបំផុតនៅផ្នែកកណ្តាល។ ចូលរួមជាមួយទីលានស្តេចរបាក់នៅជិតខាង។', address: 'អង្គរធំ សៀមរាប' },
    ],
  },
  {
    folder: 'Tonle Sap Lake',
    lat: 13.2122, lng: 103.8100,
    category: 'nature',
    imageKey: 'places/places-9.jpg',
    entryFee: 5,
    openingHours: '08:00–17:00',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'Tonle Sap Lake', description: 'Southeast Asia\'s largest freshwater lake, Tonle Sap is a biosphere reserve with floating villages, rich birdlife, and a unique reversing flow during the monsoon.', tips: 'Take a boat tour from Chong Khneas or Kampong Phluk. Best visited during wet season (Jun–Nov) when water levels are high.', address: 'Siem Reap Province' },
      { lang: 'zh', name: '洞里萨湖', description: '东南亚最大的淡水湖，洞里萨湖是一个生物圈保护区，拥有浮村、丰富的鸟类资源和季风期间独特的逆流现象。', tips: '从 Chong Khneas 或 Kampong Phluk 乘船游览。雨季（6月至11月）水位高时最适合参观。', address: '暹粒省' },
      { lang: 'km', name: 'បឹងទន្លេសាប', description: 'បឹងទឹកផុសធំជាងគេនៅអាស៊ីអាគ្នេយ៍។', tips: 'ជិះទូកពីជ័យ ឬកំពង់ភ្លុក។ ទស្សនាល្អបំផុតក្នុងរដូវវស្សា។', address: 'ខេត្តសៀមរាប' },
    ],
  },
  {
    folder: 'War Museum Cambodia',
    lat: 13.3680, lng: 103.8190,
    category: 'museum',
    imageKey: 'places/places-10.jpg',
    entryFee: 5,
    openingHours: '08:00–17:30',
    dressCode: 'Casual',
    translations: [
      { lang: 'en', name: 'War Museum Cambodia', description: 'An open-air museum displaying decommissioned military hardware, landmines, and artifacts from Cambodia\'s decades of conflict. It provides sobering insight into the country\'s recent history.', tips: 'The collection includes tanks, artillery, and aircraft. Allow 1 hour. Not suitable for very young children.', address: 'National Road 6, Siem Reap' },
      { lang: 'zh', name: '柬埔寨战争博物馆', description: '一座露天博物馆，展示退役的军事装备、地雷和柬埔寨数十年冲突的文物。为该国近代历史提供了令人警醒的洞察。', tips: '收藏包括坦克、大炮和飞机。预留1小时。不适合很小的孩子。', address: '暹粒6号国道' },
      { lang: 'km', name: 'សារមន្ទីរសង្គ្រាមកម្ពុជា', description: 'សារមន្ទីរក្រៅផ្ទះដែលបង្ហាញនូវឧបករណ៍យោធាដែលបានដកចេញ មីន និងវត្ថុបុរាណពីជំលោះរបស់កម្ពុជា។', tips: 'ការប្រមូលមានរថយន្តកង់ កាំភ្លើង និងយន្តហោះ។ ចាក់ពេល១ម៉ោង។', address: 'ផ្លូវជាតិលេខ៦ សៀមរាប' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed function (idempotent — skips places that already exist)
// ---------------------------------------------------------------------------
async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • places from /data directory');

  // Build a set of existing English names for idempotency
  const existing = await prisma.placeTranslation.findMany({
    where: { language: 'en' },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

  let created = 0;
  let skipped = 0;

  for (const p of PLACES) {
    const enName = p.translations.find((t) => t.lang === 'en')!.name;
    if (existingNames.has(enName.toLowerCase())) {
      skipped++;
      continue;
    }

    const imageUrl = imageUrls[p.imageKey];
    if (!imageUrl) {
      console.warn(`    ⚠ image key "${p.imageKey}" not found in image-urls.json, skipping ${enName}`);
      continue;
    }

    await prisma.place.create({
      data: {
        category: p.category,
        latitude: p.lat,
        longitude: p.lng,
        images: [imageUrl],
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
    created++;
  }

  console.log(`  ✅ Created ${created} places, skipped ${skipped} (already exist)`);
}

// Self-execute when run directly (npx ts-node ...)
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('\n✅ Seed complete.\n'))
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export = seed;
