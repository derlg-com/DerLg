import { ItemType, PackageKind, PricingMode, TransportKind } from '@prisma/client';

/**
 * Hand-authored inventory that has no counterpart in `data/`: where people
 * sleep, how they move between cities, and who guides them. Prices are integer
 * USD cents and reflect realistic 2026 Cambodia rates.
 *
 * Image URLs point at `/seed/...` paths written by the seed script; Task 19
 * rewrites them to the R2 public host.
 */

export interface HotelSeed {
  slug: string;
  name: string;
  citySlug: string;
  description: string;
  address: string;
  starRating: number;
  pricePerNightCents: number;
  amenities: string[];
  roomsPerNight: number;
  latitude: number;
  longitude: number;
}

export const HOTELS: HotelSeed[] = [
  {
    slug: 'lotus-lodge-siem-reap',
    name: 'Lotus Lodge',
    citySlug: 'siem-reap',
    description:
      'A twelve-room guesthouse ten minutes from Pub Street, with a small pool, free bicycles and staff who will happily wake you at 4:30am for sunrise.',
    address: 'Wat Bo Village, Sala Kamreuk, Siem Reap',
    starRating: 2,
    pricePerNightCents: 2800,
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Pool', 'Bicycle hire', 'Breakfast'],
    roomsPerNight: 12,
    latitude: 13.3546,
    longitude: 103.8598,
  },
  {
    slug: 'angkor-terrace-hotel',
    name: 'Angkor Terrace Hotel',
    citySlug: 'siem-reap',
    description:
      'Mid-range comfort on the road to the temples: saltwater pool, spa, and a breakfast that starts at 5am for early risers.',
    address: 'Charles de Gaulle Road, Siem Reap',
    starRating: 3,
    pricePerNightCents: 5400,
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Pool', 'Spa', 'Airport transfer', 'Breakfast'],
    roomsPerNight: 30,
    latitude: 13.3671,
    longitude: 103.8448,
  },
  {
    slug: 'sokha-heritage-residence',
    name: 'Sokha Heritage Residence',
    citySlug: 'siem-reap',
    description:
      'A restored 1960s villa with eighteen suites, a courtyard restaurant serving modern Khmer tasting menus, and a private tuk-tuk fleet.',
    address: 'Oum Khun Street, Siem Reap',
    starRating: 5,
    pricePerNightCents: 18500,
    amenities: [
      'Free Wi-Fi',
      'Air conditioning',
      'Pool',
      'Spa',
      'Restaurant',
      'Airport transfer',
      'Private tuk-tuk',
      'Breakfast',
    ],
    roomsPerNight: 18,
    latitude: 13.3583,
    longitude: 103.8564,
  },
  {
    slug: 'riverside-boutique-phnom-penh',
    name: 'Riverside Boutique',
    citySlug: 'phnom-penh',
    description:
      'Twenty rooms on Sisowath Quay with Mekong-facing balconies and a rooftop bar two minutes from the Royal Palace.',
    address: 'Sisowath Quay, Daun Penh, Phnom Penh',
    starRating: 3,
    pricePerNightCents: 6200,
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Rooftop bar', 'River view', 'Breakfast'],
    roomsPerNight: 20,
    latitude: 11.5695,
    longitude: 104.9312,
  },
  {
    slug: 'bassac-lane-suites',
    name: 'Bassac Lane Suites',
    citySlug: 'phnom-penh',
    description:
      'Design-led suites in BKK1 above the city’s best cocktail lanes. Walkable to the Russian Market and Independence Monument.',
    address: 'Street 308, Boeung Keng Kang, Phnom Penh',
    starRating: 4,
    pricePerNightCents: 11000,
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Pool', 'Gym', 'Restaurant', 'Breakfast'],
    roomsPerNight: 24,
    latitude: 11.5449,
    longitude: 104.9231,
  },
  {
    slug: 'mekong-budget-inn',
    name: 'Mekong Budget Inn',
    citySlug: 'phnom-penh',
    description:
      'Clean, cheap and central, with dorm and private rooms, laundry, and a noticeboard full of bus timetables.',
    address: 'Street 172, Daun Penh, Phnom Penh',
    starRating: 1,
    pricePerNightCents: 1600,
    amenities: ['Free Wi-Fi', 'Fan', 'Shared kitchen', 'Laundry'],
    roomsPerNight: 16,
    latitude: 11.5719,
    longitude: 104.9219,
  },
];

export interface TransportSeed {
  slug: string;
  kind: TransportKind;
  operator: string;
  originCitySlug: string;
  destinationCitySlug: string;
  departureTime: string;
  durationMinutes: number;
  pricePerSeatCents: number;
  seatsPerDeparture: number;
}

export const TRANSPORTS: TransportSeed[] = [
  {
    slug: 'giant-ibis-pp-sr-0800',
    kind: 'BUS',
    operator: 'Giant Ibis',
    originCitySlug: 'phnom-penh',
    destinationCitySlug: 'siem-reap',
    departureTime: '08:00',
    durationMinutes: 390,
    pricePerSeatCents: 1800,
    seatsPerDeparture: 36,
  },
  {
    slug: 'mekong-express-sr-pp-0730',
    kind: 'BUS',
    operator: 'Mekong Express',
    originCitySlug: 'siem-reap',
    destinationCitySlug: 'phnom-penh',
    departureTime: '07:30',
    durationMinutes: 400,
    pricePerSeatCents: 1600,
    seatsPerDeparture: 40,
  },
  {
    slug: 'private-van-pp-sr',
    kind: 'VAN',
    operator: 'DerLg Private Transfers',
    originCitySlug: 'phnom-penh',
    destinationCitySlug: 'siem-reap',
    departureTime: '09:00',
    durationMinutes: 330,
    pricePerSeatCents: 9500,
    seatsPerDeparture: 8,
  },
  {
    slug: 'temple-tuktuk-day-siem-reap',
    kind: 'TUKTUK',
    operator: 'Siem Reap Tuk-Tuk Collective',
    originCitySlug: 'siem-reap',
    destinationCitySlug: 'siem-reap',
    departureTime: '05:00',
    durationMinutes: 600,
    pricePerSeatCents: 2200,
    seatsPerDeparture: 4,
  },
];

export interface GuideSeed {
  slug: string;
  fullName: string;
  citySlug: string;
  bio: string;
  languages: string[];
  pricePerDayCents: number;
  rating: number;
  yearsExperience: number;
  dailyCapacity: number;
}

export const GUIDES: GuideSeed[] = [
  {
    slug: 'sokha-chan',
    fullName: 'Sokha Chan',
    citySlug: 'siem-reap',
    bio: 'Licensed Angkor guide for fourteen years, archaeology graduate, and the person to ask about which temple is quiet at 7am.',
    languages: ['English', 'Khmer', 'Mandarin'],
    pricePerDayCents: 4500,
    rating: 4.9,
    yearsExperience: 14,
    dailyCapacity: 1,
  },
  {
    slug: 'lida-prum',
    fullName: 'Lida Prum',
    citySlug: 'siem-reap',
    bio: 'Specialises in family trips: shorter walks, shade breaks, and a genuine talent for keeping eight-year-olds interested in bas-relief.',
    languages: ['English', 'Khmer'],
    pricePerDayCents: 3800,
    rating: 4.8,
    yearsExperience: 9,
    dailyCapacity: 1,
  },
  {
    slug: 'vichea-nou',
    fullName: 'Vichea Nou',
    citySlug: 'phnom-penh',
    bio: 'Historian who guides the S-21 and Choeung Ek route with care and context, and knows the city’s street-food lanes just as well.',
    languages: ['English', 'Khmer', 'French'],
    pricePerDayCents: 4200,
    rating: 4.9,
    yearsExperience: 11,
    dailyCapacity: 1,
  },
  {
    slug: 'mei-ling-tan',
    fullName: 'Mei Ling Tan',
    citySlug: 'phnom-penh',
    bio: 'Mandarin-first guide for travellers from China and Singapore, with a focus on markets, tailoring and food.',
    languages: ['Mandarin', 'English', 'Khmer'],
    pricePerDayCents: 4000,
    rating: 4.7,
    yearsExperience: 7,
    dailyCapacity: 1,
  },
];

export interface PackageDayItemSeed {
  type: ItemType;
  /** Slug of the referenced place/hotel/transport/guide. Omitted for CUSTOM. */
  refSlug?: string;
  title: string;
  description?: string;
  startTime?: string;
  durationMinutes: number;
  /** Extra cost beyond the referenced resource's own price, in cents. */
  priceCents?: number;
  bookable?: boolean;
}

export interface PackageDaySeed {
  dayNumber: number;
  title: string;
  summary: string;
  items: PackageDayItemSeed[];
}

export interface PackageSeed {
  slug: string;
  title: string;
  summary: string;
  citySlug: string;
  kind: PackageKind;
  pricingMode: PricingMode;
  durationDays: number;
  basePriceCents: number;
  minGroupSize: number;
  maxGroupSize: number;
  kidFriendly: boolean;
  featured: boolean;
  heroPlaceSlug: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  days: PackageDaySeed[];
}

export const PACKAGES: PackageSeed[] = [
  {
    slug: 'angkor-essentials-3-day',
    title: 'Angkor Essentials',
    summary:
      'Three days built around the temples that matter, paced so you are never queueing in the midday sun.',
    citySlug: 'siem-reap',
    kind: 'PUBLIC',
    pricingMode: 'PER_PERSON',
    durationDays: 3,
    basePriceCents: 18900,
    minGroupSize: 1,
    maxGroupSize: 16,
    kidFriendly: true,
    featured: true,
    heroPlaceSlug: 'angkor-wat',
    highlights: [
      'Sunrise at Angkor Wat before the coaches arrive',
      'The face towers of Bayon in late-afternoon light',
      'Ta Prohm and Preah Khan with a licensed archaeology guide',
    ],
    inclusions: [
      'Two nights accommodation with breakfast',
      'Licensed English-speaking guide for three days',
      'Private tuk-tuk for all temple transfers',
      'Angkor Archaeological Park pass',
      'Bottled water and cold towels',
    ],
    exclusions: ['International flights', 'Lunch and dinner', 'Travel insurance', 'Gratuities'],
    days: [
      {
        dayNumber: 1,
        title: 'Arrival and the small circuit',
        summary:
          'Land, settle in, then ease into Angkor with the quieter eastern temples and a first sunset.',
        items: [
          {
            type: 'HOTEL',
            refSlug: 'angkor-terrace-hotel',
            title: 'Check in at Angkor Terrace Hotel',
            startTime: '13:00',
            durationMinutes: 60,
          },
          {
            type: 'GUIDE',
            refSlug: 'sokha-chan',
            title: 'Meet your guide, Sokha Chan',
            startTime: '15:00',
            durationMinutes: 30,
          },
          {
            type: 'PLACE',
            refSlug: 'banteay-kdei',
            title: 'Banteay Kdei',
            startTime: '15:30',
            durationMinutes: 60,
          },
          {
            type: 'PLACE',
            refSlug: 'srah-srang',
            title: 'Sunset at Srah Srang',
            startTime: '17:00',
            durationMinutes: 30,
          },
        ],
      },
      {
        dayNumber: 2,
        title: 'Sunrise at Angkor Wat, then Angkor Thom',
        summary:
          'The big day: sunrise over the reflecting pool, the bas-reliefs, then the walled city and its face towers.',
        items: [
          {
            type: 'TRANSPORT',
            refSlug: 'temple-tuktuk-day-siem-reap',
            title: 'Private tuk-tuk, 05:00 pickup',
            startTime: '05:00',
            durationMinutes: 600,
          },
          {
            type: 'PLACE',
            refSlug: 'angkor-wat',
            title: 'Sunrise and bas-reliefs at Angkor Wat',
            startTime: '05:20',
            durationMinutes: 180,
          },
          {
            type: 'PLACE',
            refSlug: 'angkor-thom-south-gate',
            title: 'South gate and Angkor Thom',
            startTime: '09:00',
            durationMinutes: 120,
          },
          {
            type: 'PLACE',
            refSlug: 'bayon-temple',
            title: 'Bayon face towers',
            startTime: '15:30',
            durationMinutes: 90,
          },
          {
            type: 'PLACE',
            refSlug: 'terrace-of-the-elephants',
            title: 'Terrace of the Elephants',
            startTime: '17:00',
            durationMinutes: 40,
          },
        ],
      },
      {
        dayNumber: 3,
        title: 'Jungle temples and the market',
        summary:
          'Ta Prohm and Preah Khan in the morning, then the old market and a proper Khmer lunch before you leave.',
        items: [
          {
            type: 'PLACE',
            refSlug: 'ta-prohm',
            title: 'Ta Prohm',
            startTime: '07:30',
            durationMinutes: 75,
          },
          {
            type: 'PLACE',
            refSlug: 'preah-khan',
            title: 'Preah Khan',
            startTime: '09:15',
            durationMinutes: 90,
          },
          {
            type: 'PLACE',
            refSlug: 'old-market-psar-chaa',
            title: 'Old Market Psar Chaa',
            startTime: '11:30',
            durationMinutes: 60,
          },
        ],
      },
    ],
  },
  {
    slug: 'private-family-angkor-4-day',
    title: 'Private Family Angkor',
    summary:
      'A four-day private journey shaped around younger travellers: shorter temple walks, a water park afternoon, and full flexibility to reshape any day.',
    citySlug: 'siem-reap',
    kind: 'PRIVATE',
    pricingMode: 'PER_GROUP',
    durationDays: 4,
    basePriceCents: 128000,
    minGroupSize: 2,
    maxGroupSize: 8,
    kidFriendly: true,
    featured: true,
    heroPlaceSlug: 'bayon-temple',
    highlights: [
      'Private guide chosen for working well with children',
      'Temple mornings, pool afternoons',
      'A floating village boat trip on Tonle Sap',
      'Every day reorderable in the journey editor',
    ],
    inclusions: [
      'Three nights in a family suite with breakfast',
      'Private guide and air-conditioned van throughout',
      'Angkor Archaeological Park passes',
      'Tonle Sap boat charter',
      'Water, snacks and sun cream',
    ],
    exclusions: ['Flights', 'Lunch and dinner', 'Insurance', 'Water park entry for adults'],
    days: [
      {
        dayNumber: 1,
        title: 'Settle in slowly',
        summary: 'Arrive, swim, and take a gentle first look at the town.',
        items: [
          {
            type: 'HOTEL',
            refSlug: 'sokha-heritage-residence',
            title: 'Check in at Sokha Heritage Residence',
            startTime: '14:00',
            durationMinutes: 60,
          },
          {
            type: 'GUIDE',
            refSlug: 'lida-prum',
            title: 'Meet your family guide, Lida Prum',
            startTime: '16:00',
            durationMinutes: 30,
          },
          {
            type: 'PLACE',
            refSlug: 'old-market-psar-chaa',
            title: 'Old Market treasure hunt',
            startTime: '16:30',
            durationMinutes: 60,
          },
        ],
      },
      {
        dayNumber: 2,
        title: 'Angkor Wat before the heat',
        summary: 'An early start, a shaded temple, and back to the pool by lunch.',
        items: [
          {
            type: 'PLACE',
            refSlug: 'angkor-wat',
            title: 'Angkor Wat at first light',
            startTime: '05:30',
            durationMinutes: 120,
          },
          {
            type: 'PLACE',
            refSlug: 'ta-prohm',
            title: 'Ta Prohm — the jungle temple',
            startTime: '08:00',
            durationMinutes: 60,
          },
          {
            type: 'CUSTOM',
            title: 'Pool afternoon and nap',
            description: 'Nothing scheduled. This is deliberate.',
            startTime: '13:00',
            durationMinutes: 240,
            bookable: false,
          },
        ],
      },
      {
        dayNumber: 3,
        title: 'Water day',
        summary: 'A boat through the flooded forest, then the stilted village of Kampong Phluk.',
        items: [
          {
            type: 'PLACE',
            refSlug: 'kampong-phluk-floating-village',
            title: 'Kampong Phluk by boat',
            startTime: '08:30',
            durationMinutes: 210,
          },
          {
            type: 'PLACE',
            refSlug: 'tonle-sap-lake',
            title: 'Tonle Sap sunset cruise',
            startTime: '16:30',
            durationMinutes: 120,
          },
        ],
      },
      {
        dayNumber: 4,
        title: 'Faces, then home',
        summary: 'Bayon’s two hundred faces and the museum, timed around your flight.',
        items: [
          {
            type: 'PLACE',
            refSlug: 'bayon-temple',
            title: 'Bayon face towers',
            startTime: '08:00',
            durationMinutes: 90,
          },
          {
            type: 'PLACE',
            refSlug: 'angkor-national-museum',
            title: 'Angkor National Museum',
            startTime: '10:00',
            durationMinutes: 120,
          },
        ],
      },
    ],
  },
  {
    slug: 'phnom-penh-history-2-day',
    title: 'Phnom Penh: History and River',
    summary:
      'Two days on the Mekong: the Royal Palace and National Museum, the harder history of S-21 and Choeung Ek, and the markets in between.',
    citySlug: 'phnom-penh',
    kind: 'PUBLIC',
    pricingMode: 'PER_PERSON',
    durationDays: 2,
    basePriceCents: 11500,
    minGroupSize: 1,
    maxGroupSize: 12,
    kidFriendly: false,
    featured: true,
    heroPlaceSlug: 'royal-palace',
    highlights: [
      'The Throne Hall and Silver Pagoda',
      'S-21 and Choeung Ek with a historian guide',
      'Art-deco Central Market and the Russian Market',
    ],
    inclusions: [
      'One night riverside accommodation with breakfast',
      'Historian guide for both days',
      'All site entrance fees',
      'Air-conditioned transfers',
    ],
    exclusions: ['Flights', 'Meals', 'Insurance', 'Gratuities'],
    days: [
      {
        dayNumber: 1,
        title: 'Palace, museum, riverfront',
        summary: 'The ceremonial city in the morning, the promenade at dusk.',
        items: [
          {
            type: 'HOTEL',
            refSlug: 'riverside-boutique-phnom-penh',
            title: 'Check in at Riverside Boutique',
            startTime: '12:00',
            durationMinutes: 45,
          },
          {
            type: 'GUIDE',
            refSlug: 'vichea-nou',
            title: 'Meet your guide, Vichea Nou',
            startTime: '13:30',
            durationMinutes: 30,
          },
          {
            type: 'PLACE',
            refSlug: 'royal-palace',
            title: 'Royal Palace and Throne Hall',
            startTime: '14:00',
            durationMinutes: 120,
          },
          {
            type: 'PLACE',
            refSlug: 'silver-pagoda',
            title: 'Silver Pagoda',
            startTime: '16:00',
            durationMinutes: 60,
          },
          {
            type: 'PLACE',
            refSlug: 'sisowath-quay',
            title: 'Sisowath Quay at dusk',
            startTime: '17:30',
            durationMinutes: 60,
          },
        ],
      },
      {
        dayNumber: 2,
        title: 'The harder history, then the markets',
        summary:
          'S-21 and Choeung Ek in the morning with time to sit afterwards, then the markets and the train station.',
        items: [
          {
            type: 'PLACE',
            refSlug: 'tuol-sleng-genocide-museum',
            title: 'Tuol Sleng (S-21)',
            startTime: '08:30',
            durationMinutes: 120,
          },
          {
            type: 'PLACE',
            refSlug: 'choeung-ek-killing-fields',
            title: 'Choeung Ek Memorial',
            startTime: '11:00',
            durationMinutes: 150,
          },
          {
            type: 'PLACE',
            refSlug: 'russian-market-toul-tom-poung',
            title: 'Russian Market',
            startTime: '14:30',
            durationMinutes: 75,
          },
          {
            type: 'PLACE',
            refSlug: 'central-market-phsar-thmei',
            title: 'Central Market Phsar Thmei',
            startTime: '16:15',
            durationMinutes: 75,
          },
        ],
      },
    ],
  },
];
