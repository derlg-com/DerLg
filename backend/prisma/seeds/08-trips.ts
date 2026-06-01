// =============================================================================
// Seed: 08 — Trips / packages with itinerary
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface TripEntry {
  category: 'temples' | 'nature' | 'culture' | 'adventure' | 'food';
  durationDays: number;
  basePriceUsd: number;
  maxCapacity: number;
  coverImage: string;
  images: string[];
  translations: {
    lang: SupportedLanguage;
    title: string;
    subtitle?: string;
    description: string;
    includedItems: string[];
    excludedItems: string[];
    cancellationPolicy?: string;
    meetingPoint?: string;
  }[];
  itinerary: {
    dayNumber: number;
    sortOrder: number;
    translations: {
      lang: SupportedLanguage;
      title: string;
      description: string;
    }[];
  }[];
}

const TRIPS: TripEntry[] = [
  {
    category: 'temples',
    durationDays: 3,
    basePriceUsd: 299,
    maxCapacity: 12,
    coverImage: imageUrls['trips/angkor-classic.jpg'],
    images: [imageUrls['trips/angkor-classic.jpg']],
    translations: [
      {
        lang: 'en',
        title: 'Angkor Classic Discovery',
        subtitle: '3 Days of Ancient Wonders',
        description: 'Explore the crown jewels of the Khmer Empire with expert guides. From sunrise at Angkor Wat to the mystical faces of Bayon and the jungle-clad ruins of Ta Prohm, this immersive journey reveals the secrets of a lost civilization.',
        includedItems: ['Licensed English-speaking guide', 'AC transport', '2 nights boutique hotel', 'All temple passes', 'Daily breakfast', 'Bottled water'],
        excludedItems: ['International flights', 'Travel insurance', 'Personal expenses', 'Meals not specified'],
        cancellationPolicy: 'Full refund up to 7 days before departure. 50% refund for cancellations 3-6 days prior.',
        meetingPoint: 'Siem Reap International Airport or your hotel lobby',
      },
      {
        lang: 'zh',
        title: '吴哥经典探索之旅',
        subtitle: '3天古代奇观之旅',
        description: '在专业导游的带领下探索高棉帝国的瑰宝。从吴哥窟的日出到巴戎寺神秘的石脸，再到被丛林覆盖的塔布茏寺废墟，这段沉浸式旅程揭示了一个失落文明的秘密。',
        includedItems: ['持证英语导游', '空调交通', '2晚精品酒店', '所有寺庙门票', '每日早餐', '瓶装水'],
        excludedItems: ['国际航班', '旅行保险', '个人开支', '未注明的餐食'],
        cancellationPolicy: '出发前7天可全额退款。出发前3-6天取消可退50%。',
        meetingPoint: '暹粒国际机场或您酒店的大堂',
      },
      {
        lang: 'km',
        title: 'ការរុករកអង្គរបុរាណ',
        subtitle: '៣ ថ្ងៃនៃអស្ចារ្យភាពបុរាណ',
        description: 'រុករកត្បូងរបស់ចក្រភពខ្មែរជាមួយមគ្គុទេសក៍ជំនាញ។ ពីថ្ងៃរះនៅអង្គរវត្តរហូតដល់មុខអាថ៌កំបាំងនៃបាយ័ន និងប្រាសាទបុរាណតាព្រហ្មដែលពិដានដោយព្រៃភ្នំ ដំណើរស៊ីជម្រៅនេះបង្ហាញពីអាថ៌កំបាំងនៃអរិយធម៌ដែលបាត់បង់។',
        includedItems: ['មគ្គុទេសក៍អង់គ្លេសមានអាជ្ញាប័ណ្ណ', 'ដឹកជញ្ជូនដោយម៉ាស៊ីនត្រជាក់', 'សណ្ឋាគារបូទីច ២ យប់', 'ប័ណ្ណចូលប្រាសាទទាំងអស់', 'អាហារពេលព្រឹកប្រចាំថ្ងៃ', 'ទឹកស្អាតក្នុងដប'],
        excludedItems: ['ជើងហោះហើរអន្តរជាតិ', 'ការធានាដំណើរ', 'ម្លាយផ្ទាល់ខ្លួន', 'អាហារដែលមិនបានបញ្ជាក់'],
        cancellationPolicy: 'ការសងប្រាក់វិញពេញលេញរហូតដល់ ៧ ថ្ងៃមុនពេលចាកចេញ។ សង ៥០% សម្រាប់ការបោះបង់ ៣-៦ ថ្ងៃមុន។',
        meetingPoint: 'អាកាសយានដ្ឋានអន្តរជាតិសៀមរាប ឬសាលសណ្ឋាគាររបស់អ្នក',
      },
    ],
    itinerary: [
      {
        dayNumber: 1,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Arrival & Sunset at Angkor Wat', description: 'Airport pickup and check-in at your boutique hotel. Late afternoon visit to Angkor Wat for the golden hour photography session.' },
          { lang: 'zh', title: '抵达与吴哥窟日落', description: '机场接机并入住精品酒店。傍晚前往吴哥窟拍摄黄金时段的照片。' },
          { lang: 'km', title: 'មកដល់ & ថ្ងៃលិចនៅអង្គរវត្ត', description: 'ទទួលពីអាកាសយានដ្ឋាន និងចូលស្នាក់នៅសណ្ឋាគារបូទីចរបស់អ្នក។ ទស្សនាអង្គរវត្តនៅពេលល្ងាចសម្រាប់សម័យថតរូបម៉ោងមាស។' },
        ],
      },
      {
        dayNumber: 2,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Angkor Thom & Ta Prohm', description: 'Sunrise at Angkor Wat, followed by exploration of Angkor Thom including Bayon, Baphuon, and Terrace of the Elephants. Afternoon at the jungle temple of Ta Prohm.' },
          { lang: 'zh', title: '吴哥通王城与塔布茏寺', description: '吴哥窟日出，随后探索吴哥通王城，包括巴戎寺、巴方寺和战象平台。下午前往丛林寺庙塔布茏寺。' },
          { lang: 'km', title: 'អង្គរធំ និងតាព្រហ្ម', description: 'ថ្ងៃរះនៅអង្គរវត្ត បន្ទាប់មករុករកអង្គរធំរួមមានបាយ័ន បាពួន និងព្រះលានជល់ដំរី។ រសៀលនៅប្រាសាទតាព្រហ្ម។' },
        ],
      },
      {
        dayNumber: 3,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Hidden Temples & Departure', description: 'Visit lesser-known gems like Banteay Srei and Preah Khan. Afternoon transfer to the airport or extend your stay.' },
          { lang: 'zh', title: '隐秘寺庙与 departure', description: '参观鲜为人知的瑰宝，如女王宫和圣剑寺。下午送往机场或延长您的停留时间。' },
          { lang: 'km', title: 'ប្រាសាទដែលលាក់បាំង & ការចាកចេញ', description: 'ទស្សនាត្បូងដែលមិនស្គាល់ច្រើនដូចជាបន្ទាយស្រី និងព្រះខ័ន។ ផ្ទេររសៀលទៅអាកាសយានដ្ឋាន ឬបន្តការស្នាក់នៅរបស់អ្នក។' },
        ],
      },
    ],
  },
  {
    category: 'culture',
    durationDays: 5,
    basePriceUsd: 599,
    maxCapacity: 10,
    coverImage: imageUrls['trips/cambodia-highlights.jpg'],
    images: [imageUrls['trips/cambodia-highlights.jpg']],
    translations: [
      {
        lang: 'en',
        title: 'Cambodia Highlights',
        subtitle: 'Siem Reap to Phnom Penh',
        description: 'The ultimate Cambodian journey combining ancient temples, bustling capital city, and poignant historical sites. Experience the best of culture, cuisine, and heritage.',
        includedItems: ['All domestic transport', '4-star hotels', 'Expert guides in each city', 'All entrance fees', 'Welcome dinner', 'Daily breakfast'],
        excludedItems: ['International flights', 'Visa fees', 'Travel insurance', 'Optional activities'],
        cancellationPolicy: 'Full refund up to 14 days before departure. 50% refund 7-13 days prior.',
        meetingPoint: 'Siem Reap International Airport',
      },
      {
        lang: 'zh',
        title: '柬埔寨精华之旅',
        subtitle: '从暹粒到金边',
        description: '结合古代寺庙、繁华首都和发人深省的历史遗址的终极柬埔寨之旅。体验最佳的文化、美食和遗产。',
        includedItems: ['所有国内交通', '四星级酒店', '每个城市的专业导游', '所有门票', '欢迎晚宴', '每日早餐'],
        excludedItems: ['国际航班', '签证费', '旅行保险', '自选活动'],
        cancellationPolicy: '出发前14天可全额退款。出发前7-13天可退50%。',
        meetingPoint: '暹粒国际机场',
      },
      {
        lang: 'km',
        title: 'ចំណុចគួរឱ្យកត់សម្គាល់នៃកម្ពុជា',
        subtitle: 'ពីសៀមរាបទៅភ្នំពេញ',
        description: 'ដំណើរការកម្ពុជាដ៏ពិសេសបំផុតដែលផ្សំពីប្រាសាទបុរាណ ទីក្រុងរាជធានីដ៏រវល់ និងទីតាំងប្រវត្តិសាស្រ្តដ៏ជូរចត់។ ទទួលបានបទពិសោធន៍វប្បធម៌ អាហារូបត្ថម្ភ និងមរតកដ៏ល្អបំផុត។',
        includedItems: ['ដឹកជញ្ជូនក្នុងស្រុកទាំងអស់', 'សណ្ឋាគារ ៤ ផ្កាយ', 'មគ្គុទេសក៍ជំនាញនៅរាល់ទីក្រុង', 'ថ្លៃចូលទាំងអស់', 'អាហារពេលល្ងាចស្វាគមន៍', 'អាហារពេលព្រឹកប្រចាំថ្ងៃ'],
        excludedItems: ['ជើងហោះហើរអន្តរជាតិ', 'ថ្លៃទិដ្ឋាការ', 'ការធានាដំណើរ', 'សកម្មភាពជំរើស'],
        cancellationPolicy: 'សងប្រាក់វិញពេញលេញរហូតដល់ ១៤ ថ្ងៃមុនពេលចាកចេញ។ សង ៥០% ៧-១៣ ថ្ងៃមុន។',
        meetingPoint: 'អាកាសយានដ្ឋានអន្តរជាតិសៀមរាប',
      },
    ],
    itinerary: [
      {
        dayNumber: 1,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Siem Reap Arrival', description: 'Welcome to Cambodia! Airport transfer to your hotel. Evening welcome dinner with traditional Apsara dance performance.' },
          { lang: 'zh', title: '抵达暹粒', description: '欢迎来到柬埔寨！机场接送至酒店。晚上享用欢迎晚宴，欣赏传统仙女舞蹈表演。' },
          { lang: 'km', title: 'មកដល់សៀមរាប', description: 'សូមស្វាគមន៍មកកាន់កម្ពុជា! ផ្ទេរពីអាកាសយានដ្ឋានទៅសណ្ឋាគាររបស់អ្នក។ អាហារពេលល្ងាចស្វាគមន៍ជាមួយការសម្តែងរបាំអប្សរាប្រពៃណី។' },
        ],
      },
      {
        dayNumber: 2,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Angkor Wat Sunrise', description: 'Pre-dawn departure for Angkor Wat sunrise. Full day temple exploration with expert guide.' },
          { lang: 'zh', title: '吴哥窟日出', description: '黎明前出发前往吴哥窟看日出。与专业导游一起全天探索寺庙。' },
          { lang: 'km', title: 'ថ្ងៃរះនៅអង្គរវត្ត', description: 'ចេញដំណើរមុនពន្លឺព្រះអាទិត្យដើម្បីថ្ងៃរះនៅអង្គរវត្ត។ រុករកប្រាសាទពេញមួយថ្ងៃជាមួយមគ្គុទេសក៍ជំនាញ។' },
        ],
      },
      {
        dayNumber: 3,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Tonle Sap & Transfer to Phnom Penh', description: 'Morning boat tour of Tonle Sap floating villages. Afternoon luxury bus transfer to Phnom Penh.' },
          { lang: 'zh', title: '洞里萨湖与前往金边', description: '上午乘船游览洞里萨湖 floating villages。下午乘坐豪华巴士前往金边。' },
          { lang: 'km', title: 'ទន្លេសាប និងផ្លាស់ទីទៅភ្នំពេញ', description: 'ដំណើរទស្សនកិច្ចទូកព្រឹកនៅភូមិលើទឹកទន្លេសាប។ ផ្លាស់ទីរថយន្តក្រុងប្រណិតរសៀលទៅភ្នំពេញ។' },
        ],
      },
      {
        dayNumber: 4,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Phnom Penh Heritage', description: 'Royal Palace, Silver Pagoda, National Museum, and evening food tour through the Russian Market.' },
          { lang: 'zh', title: '金边遗产', description: '皇宫、银塔、国家博物馆，以及晚上在俄罗斯市场的美食之旅。' },
          { lang: 'km', title: 'មរតកភ្នំពេញ', description: 'ព្រះបរមរាជវាំង វត្តព្រះកែវមរកត សារមន្ទីរជាតិ និងដំណើរអាហារពេលល្ងាចតាមផ្សាររុស្ស៊ី។' },
        ],
      },
      {
        dayNumber: 5,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'History & Departure', description: 'Visit to the Killing Fields and Tuol Sleng Genocide Museum. Afternoon transfer to airport or extend your stay.' },
          { lang: 'zh', title: '历史与 departure', description: '参观杀人场和吐斯廉屠杀博物馆。下午送往机场或延长您的停留时间。' },
          { lang: 'km', title: 'ប្រវត្តិសាស្រ្ត និងការចាកចេញ', description: 'ទស្សនាវាលពិឃាត និងសារមន្ទីរប្រល័យពូជសាសន៍ទួលស្លែង។ ផ្ទេររសៀលទៅអាកាសយានដ្ឋាន ឬបន្តការស្នាក់នៅរបស់អ្នក។' },
        ],
      },
    ],
  },
  {
    category: 'adventure',
    durationDays: 4,
    basePriceUsd: 449,
    maxCapacity: 8,
    coverImage: imageUrls['trips/adventure-north.jpg'],
    images: [imageUrls['trips/adventure-north.jpg']],
    translations: [
      {
        lang: 'en',
        title: 'Northern Cambodia Adventure',
        subtitle: 'Ratanakiri & Mondulkiri',
        description: 'Venture off the beaten path into Cambodia\'s wild northeast. Trek through virgin rainforest, swim in volcanic crater lakes, and meet indigenous minority communities.',
        includedItems: ['4WD transport', 'Eco-lodge accommodation', 'Local indigenous guides', 'All meals', 'Trekking permits', 'Waterfall visits'],
        excludedItems: ['Flights to Banlung', 'Travel insurance', 'Personal gear', 'Alcoholic beverages'],
        cancellationPolicy: 'Full refund up to 14 days before. No refund within 7 days.',
        meetingPoint: 'Banlung Airport, Ratanakiri',
      },
      {
        lang: 'zh',
        title: '柬埔寨北部探险',
        subtitle: '腊塔纳基里与蒙多基里',
        description: '冒险进入柬埔寨狂野的东北部。徒步穿越原始雨林，在火山口湖中游泳，并会见原住民少数民族社区。',
        includedItems: ['四轮驱动交通', '生态旅馆住宿', '当地原住民导游', '所有餐食', '徒步许可证', '瀑布参观'],
        excludedItems: ['飞往邦隆的航班', '旅行保险', '个人装备', '酒精饮料'],
        cancellationPolicy: '出发前14天可全额退款。7天内不予退款。',
        meetingPoint: '腊塔纳基里邦隆机场',
      },
      {
        lang: 'km',
        title: 'ផ្សងព្រេងភាគខាងជើងកម្ពុជា',
        subtitle: 'រតនគិរី និងមណ្ឌលគិរី',
        description: 'ចូលទៅក្នុងភាគឦសានព្រៃភ្នំកម្ពុជា។ ដើរតាមព្រៃភ្នំដើម ហែលទឹកក្នុងបឹងភ្នំភ្លើង និងជួបសហគមន៍ជនជាតិដើមភាគតិច។',
        includedItems: ['ដឹកជញ្ជូន 4WD', 'ទីស្នាក់នងអេកូឡុត', 'មគ្គុទេសក៍ជនជាតិដើមភាគតិច', 'អាហារទាំងអស់', 'ប័ណ្ណដើរព្រៃភ្នំ', 'ទស្សនាទឹកជ្រោះ'],
        excludedItems: ['ជើងហោះហើរទៅបានលុង', 'ការធានាដំណើរ', 'សម្ភារៈផ្ទាល់ខ្លួន', 'ភេសជ្ជៈគ្រឿងស្រវឹង'],
        cancellationPolicy: 'សងប្រាក់វិញពេញលេញរហូតដល់ ១៤ ថ្ងៃមុន។ មិនសងវិញក្នុងរយៈពេល ៧ ថ្ងៃ។',
        meetingPoint: 'អាកាសយានដ្ឋានបានលុង រតនគិរី',
      },
    ],
    itinerary: [
      {
        dayNumber: 1,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Banlung & Yeak Lom Lake', description: 'Arrive in Banlung. Afternoon swim in the sacred Yeak Lom crater lake surrounded by forest.' },
          { lang: 'zh', title: '邦隆与亚克朗湖', description: '抵达邦隆。下午在被森林环绕的神圣亚克朗火山口湖中游泳。' },
          { lang: 'km', title: 'បានលុង និងបឹងយាកឡម', description: 'មកដល់បានលុង។ ហែលទឹករសៀលនៅបឹងភ្នំភ្លើងយាកឡមដ៏ពិសិដ្ឋដែលព័ទ្ធជុំវិញដោយព្រៃភ្នំ។' },
        ],
      },
      {
        dayNumber: 2,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Virachey National Park Trek', description: 'Full day trek through primary rainforest with indigenous Kachok guides. Learn about medicinal plants and wildlife tracking.' },
          { lang: 'zh', title: '维拉切国家公园徒步', description: '与卡乔克原住民导游一起全天徒步穿越原始雨林。了解药用植物和野生动物追踪。' },
          { lang: 'km', title: 'ដើរព្រៃភ្នំឧទ្យានជាតិវីរៈជ័យ', description: 'ដើរពេញមួយថ្ងៃតាមព្រៃភ្នំដើមជាមួយមគ្គុទេសក៍កាចុកជនជាតិដើមភាគតិច។ សិក្សាអំពីរុក្ខជាតិព្យាបាល និងការតាមដានសត្វព្រៃ។' },
        ],
      },
      {
        dayNumber: 3,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Indigenous Villages & Waterfalls', description: 'Visit Tampuan and Kreung minority villages. Swim at Katieng and Cha Ong waterfalls.' },
          { lang: 'zh', title: '原住民村庄与瀑布', description: '参观他蓬和克伦少数民族村庄。在Katieng和Cha Ong瀑布游泳。' },
          { lang: 'km', title: 'ភូមិជនជាតិដើមភាគតិច និងទឹកជ្រោះ', description: 'ទស្សនាភូមិជនជាតិដើមភាគតិចតំបូង និងក្រឹង។ ហែលទឹកនៅទឹកជ្រោះកាទៀង និងចាអុង។' },
        ],
      },
      {
        dayNumber: 4,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Elephant Valley Project', description: 'Morning visit to the ethical Elephant Valley Project in Mondulkiri. Afternoon departure.' },
          { lang: 'zh', title: '大象谷项目', description: '上午参观蒙多基里有道德的大象谷项目。下午 departure。' },
          { lang: 'km', title: 'គម្រោងជ្រលងដំរី', description: 'ទស្សនាព្រឹកនៅគម្រោងជ្រលងដំរីមានសីលធម៌នៅមណ្ឌលគិរី។ ចាកចេញរសៀល។' },
        ],
      },
    ],
  },
  {
    category: 'food',
    durationDays: 3,
    basePriceUsd: 249,
    maxCapacity: 8,
    coverImage: imageUrls['trips/culinary-journey.jpg'],
    images: [imageUrls['trips/culinary-journey.jpg']],
    translations: [
      {
        lang: 'en',
        title: 'Cambodian Culinary Journey',
        subtitle: 'Cook, Taste & Explore',
        description: 'A foodie\'s dream tour through the flavors of Cambodia. From Phnom Penh\'s street food stalls to countryside cooking classes, discover the secrets of Khmer cuisine.',
        includedItems: ['All meals and snacks', 'Cooking class with local chef', 'Market tours', 'Food photography guide', 'Recipe booklet', 'Tuk-tuk transport'],
        excludedItems: ['Alcoholic beverages', 'Personal purchases', 'Travel insurance'],
        cancellationPolicy: 'Full refund up to 7 days before departure.',
        meetingPoint: 'Phnom Penh Riverside',
      },
      {
        lang: 'zh',
        title: '柬埔寨美食之旅',
        subtitle: '烹饪、品尝与探索',
        description: '美食爱好者穿越柬埔寨风味的梦想之旅。从金边的街头小吃摊到乡村烹饪课程，发现高棉美食的秘密。',
        includedItems: ['所有餐食和小吃', '与当地厨师的烹饪课', '市场游览', '美食摄影指导', '食谱手册', '嘟嘟车交通'],
        excludedItems: ['酒精饮料', '个人购物', '旅行保险'],
        cancellationPolicy: '出发前7天可全额退款。',
        meetingPoint: '金边河畔',
      },
      {
        lang: 'km',
        title: 'ដំណើរសិល្បៈធ្វើម្ហូបកម្ពុជា',
        subtitle: 'ចំអិន រសជាតិ និងរុករក',
        description: 'ដំណើរក្តីស្រមៃរបស់អ្នកចូលចិត្តអាហារតាមរយៈរសជាតិនៃកម្ពុជា។ ពីហាងលក់អាហារតាមផ្លូវភ្នំពេញរហូតដល់ថ្នាក់រៀនចំអិននៅជនបទ រកឃើញអាថ៌កំបាំងនៃអាហារខ្មែរ។',
        includedItems: ['អាហារ និងភេសជ្ជៈទាំងអស់', 'ថ្នាក់រៀនចំអិនជាមួយចុងភៅក្នុងស្រុក', 'ដំណើរផ្សារ', 'មគ្គុទេសក៍ថតរូបអាហារ', 'សៀវភៅរូបមន្ត', 'ដឹកជញ្ជូនទុកទុក'],
        excludedItems: ['ភេសជ្ជៈគ្រឿងស្រវឹង', 'ការទិញផ្ទាល់ខ្លួន', 'ការធានាដំណើរ'],
        cancellationPolicy: 'សងប្រាក់វិញពេញលេញរហូតដល់ ៧ ថ្ងៃមុនពេលចាកចេញ។',
        meetingPoint: 'វាលរបងទន្លេភ្នំពេញ',
      },
    ],
    itinerary: [
      {
        dayNumber: 1,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Street Food Safari', description: 'Evening tuk-tuk tour of Phnom Penh\'s best street food. Try num pang, fresh spring rolls, and Khmer noodles.' },
          { lang: 'zh', title: '街头美食之旅', description: '晚上乘坐嘟嘟车游览金边最佳街头美食。尝试法棍三明治、新鲜春卷和高棉面条。' },
          { lang: 'km', title: 'សាហារីអាហារផ្លូវ', description: 'ដំណើរទុកទុកល្ងាចនៃអាហារផ្លូវល្អបំផុតនៅភ្នំពេញ។ សាកល្ប់នំបុ័ង នំរុក្ខជាតិស្រស់ និងមីខ្មែរ។' },
        ],
      },
      {
        dayNumber: 2,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Market & Cooking Class', description: 'Morning at the Russian Market selecting fresh ingredients. Afternoon hands-on cooking class with a local chef.' },
          { lang: 'zh', title: '市场与烹饪课', description: '上午在俄罗斯市场挑选新鲜食材。下午与当地厨师一起参加实践烹饪课程。' },
          { lang: 'km', title: 'ផ្សារ និងថ្នាក់រៀនចំអិន', description: 'ព្រឹកនៅផ្សាររុស្ស៊ីជ្រើសរើសគ្រឿងផ្សំស្រស់ៗ។ រសៀលថ្នាក់រៀនចំអិនជាមួយចុងភៅក្នុងស្រុក។' },
        ],
      },
      {
        dayNumber: 3,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Countryside Farm Visit', description: 'Day trip to a pepper plantation in Kampot. Learn about Kampot pepper, enjoy a farm-to-table lunch, and visit a salt field.' },
          { lang: 'zh', title: '乡村农场参观', description: '前往贡布胡椒种植园的一日游。了解贡布胡椒，享用从农场到餐桌的午餐，并参观盐田。' },
          { lang: 'km', title: 'ទស្សនាចំការជនបទ', description: 'ដំណើរថ្ងៃទៅចំការម្រេចនៅកំពត។ សិក្សាអំពីម្រេចកំពត រីករាយជាមួយអាហារថ្ងៃត្រង់ពីចំការ និងទស្សនាកោះអំបិល។' },
        ],
      },
    ],
  },
  {
    category: 'nature',
    durationDays: 4,
    basePriceUsd: 399,
    maxCapacity: 12,
    coverImage: imageUrls['trips/beach-escape.jpg'],
    images: [imageUrls['trips/beach-escape.jpg']],
    translations: [
      {
        lang: 'en',
        title: 'Southern Beach Escape',
        subtitle: 'Sihanoukville, Kep & Kampot',
        description: 'Unwind on Cambodia\'s most beautiful beaches, explore charming colonial towns, and savor fresh seafood. The perfect tropical getaway.',
        includedItems: ['Beachfront resort 3 nights', 'All breakfasts', 'Island hopping boat trip', 'Kampot pepper plantation tour', 'Tuk-tuk transfers', 'Snorkeling gear'],
        excludedItems: ['Flights to Sihanoukville', 'Lunch and dinner', 'Travel insurance', 'Spa treatments'],
        cancellationPolicy: 'Full refund up to 7 days before. 50% refund 3-6 days prior.',
        meetingPoint: 'Sihanoukville International Airport',
      },
      {
        lang: 'zh',
        title: '南部海滩度假',
        subtitle: '西哈努克港、白马与贡布',
        description: '在柬埔寨最美丽的海滩上放松身心，探索迷人的殖民小镇，品尝新鲜海鲜。完美的热带度假胜地。',
        includedItems: ['海滨度假村3晚', '所有早餐', '跳岛游船之旅', '贡布胡椒种植园参观', '嘟嘟车接送', '浮潜装备'],
        excludedItems: ['飞往西哈努克港的航班', '午餐和晚餐', '旅行保险', '水疗护理'],
        cancellationPolicy: '出发前7天可全额退款。出发前3-6天可退50%。',
        meetingPoint: '西哈努克港国际机场',
      },
      {
        lang: 'km',
        title: 'ភាគខាងត្បូងឆ្នេរសមុទ្រ',
        subtitle: 'ព្រះសីហនុ កែប និងកំពត',
        description: 'សម្រាកលើឆ្នេរសមុទ្រស្រស់ស្អាតបំផុតនៃកម្ពុជា រុករកទីក្រុងអាណានិគមគួរឱ្យទាក់ទាញ និងរីករាយអាហារសមុទ្រស្រស់ៗ។ កន្លែងឈប់សម្រាកត្រូពិចដ៏ល្អបំផុត។',
        includedItems: ['រមណីយដ្ឋានមុខឆ្នេរ ៣ យប់', 'អាហារពេលព្រឹកទាំងអស់', 'ដំណើរទស្សនកិច្ចកោះ', 'ដំណើរចំការម្រេចកំពត', 'ផ្ទេរទុកទុក', 'សម្ភារៈហែលទឹក'],
        excludedItems: ['ជើងហោះហើរទៅព្រះសីហនុ', 'អាហារថ្ងៃត្រង់ និងល្ងាច', 'ការធានាដំណើរ', 'ការព្យាបាលស្ពា'],
        cancellationPolicy: 'សងប្រាក់វិញពេញលេញរហូតដល់ ៧ ថ្ងៃមុន។ សង ៥០% ៣-៦ ថ្ងៃមុន។',
        meetingPoint: 'អាកាសយានដ្ឋានអន្តរជាតិព្រះសីហនុ',
      },
    ],
    itinerary: [
      {
        dayNumber: 1,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Sihanoukville & Otres Beach', description: 'Arrive in Sihanoukville. Transfer to Otres Beach for sunset cocktails and beachfront dinner.' },
          { lang: 'zh', title: '西哈努克港与奥特雷斯海滩', description: '抵达西哈努克港。前往奥特雷斯海滩欣赏日落鸡尾酒和海滨晚餐。' },
          { lang: 'km', title: 'ព្រះសីហនុ និងឆ្នេរអូត្រេស', description: 'មកដល់ព្រះសីហនុ។ ផ្ទេរទៅឆ្នេរអូត្រេសសម្រាប់កូកទែលល្ងាច និងអាហារពេលល្ងាចមុខឆ្នេរ។' },
        ],
      },
      {
        dayNumber: 2,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Island Hopping', description: 'Boat tour to Koh Rong and Koh Rong Samloem. Snorkeling, beach barbecue, and swimming in bioluminescent plankton at night.' },
          { lang: 'zh', title: '跳岛游', description: '乘船游览高龙岛和高龙撒冷岛。浮潜、海滩烧烤，晚上在生物发光浮游生物中游泳。' },
          { lang: 'km', title: 'លេងកោះ', description: 'ដំណើរទស្សនកិច្ចទូកទៅកោះរុង និងកោះរុងសន្លឹម។ ហែលទឹកមើលផ្កាយ អាហារពិភាក្សានៅឆ្នេរ និងហែលទឹកក្នុងផ្លាង់តុងពន្លឺពេលយប់។' },
        ],
      },
      {
        dayNumber: 3,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Kep & Kampot', description: 'Transfer to Kep for fresh crab lunch at the famous crab market. Afternoon visit to Kampot pepper plantations and Bokor Mountain.' },
          { lang: 'zh', title: '白马与贡布', description: '前往白马在著名的螃蟹市场享用新鲜螃蟹午餐。下午参观贡布胡椒种植园和波哥山。' },
          { lang: 'km', title: 'កែប និងកំពត', description: 'ផ្ទេរទៅកែបសម្រាប់អាហារក្តាមស្រស់នៅផ្សារក្តាមល្បីៗ។ ទស្សនាចំការម្រេចកំពត និងភ្នំបូកគោរសៀល។' },
        ],
      },
      {
        dayNumber: 4,
        sortOrder: 1,
        translations: [
          { lang: 'en', title: 'Relaxation & Departure', description: 'Morning yoga on the beach. Free time for spa treatments or kayaking. Afternoon transfer to airport.' },
          { lang: 'zh', title: '放松与 departure', description: '早上在海滩上做瑜伽。自由时间享受水疗或皮划艇。下午送往机场。' },
          { lang: 'km', title: 'សម្រាកលំហែ និងការចាកចេញ', description: 'យោហារព្រឹកនៅឆ្នេរ។ ពេលទំនេរសម្រាប់ការព្យាបាលស្ពា ឬជិះកាយ៉ាក់។ ផ្ទេររសៀលទៅអាកាសយានដ្ឋាន។' },
        ],
      },
    ],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • trips');

  // Idempotent reseed: clear existing trips first. Translations and itinerary
  // items cascade on Trip delete (onDelete: Cascade), so this removes all
  // dependent rows and prevents duplicate trips on repeated seeding.
  await prisma.trip.deleteMany({});

  for (const t of TRIPS) {
    const trip = await prisma.trip.create({
      data: {
        category: t.category,
        durationDays: t.durationDays,
        basePriceUsd: t.basePriceUsd,
        maxCapacity: t.maxCapacity,
        coverImage: t.coverImage,
        images: t.images,
        isPublished: true,
        translations: {
          create: t.translations.map((tr) => ({
            language: tr.lang,
            title: tr.title,
            subtitle: tr.subtitle,
            description: tr.description,
            includedItems: tr.includedItems,
            excludedItems: tr.excludedItems,
            cancellationPolicy: tr.cancellationPolicy,
            meetingPoint: tr.meetingPoint,
          })),
        },
      },
    });

    for (const item of t.itinerary) {
      await prisma.tripItineraryItem.create({
        data: {
          tripId: trip.id,
          dayNumber: item.dayNumber,
          sortOrder: item.sortOrder,
          translations: {
            create: item.translations.map((tr) => ({
              language: tr.lang,
              title: tr.title,
              description: tr.description,
            })),
          },
        },
      });
    }
  }
  console.log(`  ✅ Created ${TRIPS.length} trips with itineraries`);
};
