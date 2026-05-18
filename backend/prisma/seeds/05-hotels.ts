// =============================================================================
// Seed: 05 — Hotels (Siem Reap, Phnom Penh, Sihanoukville, Kampot)
// =============================================================================

import type { PrismaClient, SupportedLanguage } from '@prisma/client';

import imageUrls = require('./image-urls.json');

interface HotelEntry {
  lat: number;
  lng: number;
  starRating?: number;
  images: string[];
  amenities: string[];
  translations: { lang: SupportedLanguage; name: string; address: string; description: string }[];
  rooms: {
    roomType: string;
    maxOccupancy: number;
    priceUsd: number;
    amenities: string[];
    images: string[];
  }[];
}

const HOTELS: HotelEntry[] = [
  {
    lat: 13.3642,
    lng: 103.8615,
    starRating: 5,
    images: [imageUrls['hotels/sokha-siem-reap.jpg']],
    amenities: ['WiFi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Parking', 'Airport Shuttle'],
    translations: [
      { lang: 'en', name: 'Sokha Siem Reap Resort', address: 'National Road No. 6, Khum Svay Dangkum, Siem Reap', description: 'A luxurious 5-star resort minutes from Angkor Wat, featuring Khmer-inspired architecture, lush tropical gardens, and world-class spa facilities.' },
      { lang: 'zh', name: '速卡暹粒度假村', address: '暹粒省6号国道', description: '距吴哥窟仅数分钟的豪华五星级度假村，拥有高棉风格建筑、郁郁葱葱的热带花园和世界一流的水疗设施。' },
      { lang: 'km', name: 'រមណីយដ្ឋានសូខាសៀមរាប', address: 'ផ្លូវជាតិលេខ៦ ឃុំស្វាយដង្គំ សៀមរាប', description: 'រមណីយដ្ឋានប្រណិត ៥ ផ្កាយមួយភាគនាទីីអង្គរវត្ត មានស្ថាបត្យកម្មប្រពៃណីខ្មែរ សួនច្បារត្រូពិចដ៏ស្រស់ត្រកាល និងសេវាកម្មស្ពាដថ្នាក់ពិភពលោក។' },
    ],
    rooms: [
      { roomType: 'Deluxe King', maxOccupancy: 2, priceUsd: 120, amenities: ['King Bed', 'City View', 'Bathtub', 'Mini Bar'], images: [] },
      { roomType: 'Premier Suite', maxOccupancy: 3, priceUsd: 220, amenities: ['King Bed', 'Living Room', 'Garden View', 'Butler Service'], images: [] },
      { roomType: 'Family Room', maxOccupancy: 4, priceUsd: 180, amenities: ['Two Queen Beds', 'Garden View', 'Kids Amenities'], images: [] },
    ],
  },
  {
    lat: 11.5724,
    lng: 104.9281,
    starRating: 5,
    images: [imageUrls['hotels/park-hyatt-phnom-penh.jpg']],
    amenities: ['WiFi', 'Pool', 'Spa', 'Gym', 'Rooftop Bar', 'Fine Dining', 'Concierge'],
    translations: [
      { lang: 'en', name: 'Park Hyatt Phnom Penh', address: 'No. 55, Street 178, Daun Penh, Phnom Penh', description: 'Ultra-luxury hotel in the heart of the capital, blending Art Deco elegance with Cambodian artistry. Features a rooftop infinity pool with Mekong River views.' },
      { lang: 'zh', name: '金边柏悦酒店', address: '金边隆边区178街55号', description: '位于首都中心的超豪华酒店，将装饰艺术优雅与高棉艺术融为一体。设有屋顶无边泳池，可欣赏湄公河美景。' },
      { lang: 'km', name: 'ផាកហ្សាយអិតភ្នំពេញ', address: 'ផ្ទះលេខ៥៥ ផ្លូវ១៧៨ សង្កាត់ដូនពេញ ភ្នំពេញ', description: 'សណ្ឋាគារប្រណិតបំផុតនៅកណ្តាលរាជធានី ផ្សំភាពសែនស្អាត Art Deco ជាមួយសិល្បៈកម្ពុជា។ មានសួនហែលទឹកលើដំបូលអាគារជាមួយទិដ្ឋភាពទន្លេមេគង្គ។' },
    ],
    rooms: [
      { roomType: 'Park King', maxOccupancy: 2, priceUsd: 180, amenities: ['King Bed', 'River View', 'Rain Shower', 'Nespresso'], images: [] },
      { roomType: 'Park Suite', maxOccupancy: 3, priceUsd: 350, amenities: ['Separate Living Area', 'River View', 'Soaking Tub'], images: [] },
    ],
  },
  {
    lat: 11.5691,
    lng: 104.9308,
    starRating: 5,
    images: [imageUrls['hotels/raffles-grand.jpg']],
    amenities: ['WiFi', 'Pool', 'Spa', 'Historic Charm', 'French Restaurant', 'Courtyard Garden'],
    translations: [
      { lang: 'en', name: "Raffles Hotel Le Royal", address: '92 Rukhak Vithei Daun Penh, Phnom Penh', description: 'An iconic heritage hotel since 1929, Raffles Le Royal has hosted royalty and celebrities. Its colonial architecture, lush gardens, and legendary Elephant Bar are unmatched.' },
      { lang: 'zh', name: '莱佛士皇家酒店', address: '金边隆边区92号', description: '自1929年以来的标志性遗产酒店，莱佛士皇家酒店曾接待过皇室成员和名人。其殖民建筑、郁郁葱葱的花园和传奇的大象酒吧无与伦比。' },
      { lang: 'km', name: 'សណ្ឋាគាររ៉ាហ្វ្លេស លឺរ៉យ៉ាល់', address: 'ផ្លូវរុខក់វិថីដូនពេញ លេខ៩២ ភ្នំពេញ', description: 'សណ្ឋាគារបេតិកភណ្ឌដ៏ល្បីល្បាញចាប់តាំងពីឆ្នាំ១៩២៩ រ៉ាហ្វ្លេស លឺរ៉យ៉ាល់បានទទួលភ្ញៀវជាសម្តេចនិងតារាល្បីៗ។ ស្ថាបត្យកម្មអាណានិគម សួនច្បារស្រស់ត្រកាល និងបារ Elephant ដ៏ល្បីល្បាញគ្មានគូប្រៀប។' },
    ],
    rooms: [
      { roomType: 'State Room', maxOccupancy: 2, priceUsd: 250, amenities: ['King Bed', 'Garden View', 'Four-Poster Bed', 'Vintage Furniture'], images: [] },
      { roomType: 'Personality Suite', maxOccupancy: 2, priceUsd: 450, amenities: ['Named after famous guest', 'Living Room', 'Garden View', 'Butler'], images: [] },
    ],
  },
  {
    lat: 13.3528,
    lng: 103.8578,
    starRating: 4,
    images: [imageUrls['hotels/belmond-la-residence.jpg']],
    amenities: ['WiFi', 'Pool', 'Spa', 'Fine Dining', 'Cooking Classes', 'Tuk-Tuk Service'],
    translations: [
      { lang: 'en', name: 'Belmond La Residence d\'Angkor', address: 'River Road, Siem Reap', description: 'An intimate boutique hotel on the Siem Reap River, offering authentic Khmer hospitality, lush gardens, and easy access to the temples.' },
      { lang: 'zh', name: '贝尔蒙德吴哥居所酒店', address: '暹粒河滨路', description: '位于暹粒河畔的私密精品酒店，提供正宗的高棉待客之道、郁郁葱葱的花园和便捷的寺庙通道。' },
      { lang: 'km', name: 'បែលម៉ង់ ឡារ៉េស៊ីដែន ដអង្គរ', address: 'ផ្លូវទន្លេ សៀមរាប', description: 'សណ្ឋាគារបូទីចដ៏ជិតស្និទ្ធនៅលើទន្លេសៀមរាប ផ្តល់នូវការធ្វើដំណើរខ្មែរពិតប្រាកដ សួនច្បារត្រូពិច និងផ្លូវងាយស្រួលទៅប្រាសាទ។' },
    ],
    rooms: [
      { roomType: 'Junior Suite', maxOccupancy: 2, priceUsd: 160, amenities: ['King Bed', 'River View', 'Private Balcony'], images: [] },
      { roomType: 'Pool Suite', maxOccupancy: 2, priceUsd: 280, amenities: ['Private Plunge Pool', 'Garden View', 'Outdoor Shower'], images: [] },
    ],
  },
  {
    lat: 13.3555,
    lng: 103.8550,
    starRating: 4,
    images: [imageUrls['hotels/shinta-mani.jpg']],
    amenities: ['WiFi', 'Pool', 'Spa', 'Social Enterprise', 'Rooftop Bar', 'Art Gallery'],
    translations: [
      { lang: 'en', name: 'Shinta Mani Angkor', address: 'Junction of Oum Khun and 14th Street, Siem Reap', description: 'A design-forward boutique hotel with a social mission. Every stay supports local community projects through the Shinta Mani Community.' },
      { lang: 'zh', name: '圣塔玛尼吴哥酒店', address: '暹粒翁坤街与14街交汇处', description: '一家具有社会使命的前瞻设计精品酒店。每次入住都通过圣塔玛尼社区支持当地社区项目。' },
      { lang: 'km', name: 'ស៊ីនតាម៉ានី អង្គរ', address: 'ផ្លូវអ៊ុំឃុន និងផ្លូវ១៤ សៀមរាប', description: 'សណ្ឋាគារបូទីចរចនាទំនើបជាមួយបេសកម្មសង្គម។ រាល់ការស្នាក់នៅគាំទ្រគម្រោងសហគមន៍ក្នុងស្រុកតាមរយៈសហគមន៍ស៊ីនតាម៉ានី។' },
    ],
    rooms: [
      { roomType: 'Shinta Mani Room', maxOccupancy: 2, priceUsd: 130, amenities: ['Queen Bed', 'Pool View', 'Rain Shower'], images: [] },
      { roomType: 'Courtyard Suite', maxOccupancy: 3, priceUsd: 210, amenities: ['King Bed', 'Private Courtyard', 'Outdoor Tub'], images: [] },
    ],
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • hotels');

  for (const h of HOTELS) {
    const hotel = await prisma.hotel.create({
      data: {
        latitude: h.lat,
        longitude: h.lng,
        starRating: h.starRating,
        images: h.images,
        amenities: h.amenities,
        isPublished: true,
        translations: {
          create: h.translations.map((t) => ({
            language: t.lang,
            name: t.name,
            address: t.address,
            description: t.description,
          })),
        },
      },
    });

    for (const r of h.rooms) {
      await prisma.hotelRoom.create({
        data: {
          hotelId: hotel.id,
          roomType: r.roomType,
          maxOccupancy: r.maxOccupancy,
          priceUsd: r.priceUsd,
          amenities: r.amenities,
          images: r.images,
          isActive: true,
        },
      });
    }
  }
  console.log(`  ✅ Created ${HOTELS.length} hotels with rooms`);
};
