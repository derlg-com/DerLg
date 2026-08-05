/** Mirrors the API's catalogue select shapes (apps/api/.../catalog.interface.ts). */

export type PackageKind = 'PUBLIC' | 'PRIVATE';
export type PricingMode = 'PER_PERSON' | 'PER_GROUP';
export type ItemType = 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'CUSTOM';
export type PlaceCategory =
  | 'TEMPLE'
  | 'MUSEUM'
  | 'MARKET'
  | 'NATURE'
  | 'LANDMARK'
  | 'ENTERTAINMENT'
  | 'FOOD';
export type TransportKind = 'VAN' | 'BUS' | 'TUKTUK' | 'PRIVATE_CAR';

export interface CityRef {
  slug: string;
  name: string;
}

export interface City extends CityRef {
  id: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface PlaceImage {
  url: string;
  position: number;
  author: string | null;
  license: string | null;
  sourceUrl: string | null;
}

export interface PlaceSummary {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  entranceFeeCents: number;
  visitDurationMinutes: number;
  dailyCapacity: number;
  city: CityRef;
  images: PlaceImage[];
}

export interface PlaceDetail extends Omit<PlaceSummary, 'city'> {
  description: string;
  mapsUrl: string | null;
  city: City;
}

export interface Hotel {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  starRating: number;
  pricePerNightCents: number;
  amenities: string[];
  imageUrl: string | null;
  roomsPerNight: number;
  latitude: number;
  longitude: number;
  city: CityRef;
}

export interface Transport {
  id: string;
  slug: string;
  kind: TransportKind;
  operator: string;
  departureTime: string;
  durationMinutes: number;
  pricePerSeatCents: number;
  seatsPerDeparture: number;
  imageUrl: string | null;
  originCity: CityRef;
  destinationCity: CityRef;
}

export interface Guide {
  id: string;
  slug: string;
  fullName: string;
  bio: string;
  languages: string[];
  pricePerDayCents: number;
  rating: number;
  yearsExperience: number;
  avatarUrl: string | null;
  dailyCapacity: number;
  city: CityRef;
}

export interface PackageSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: PackageKind;
  pricingMode: PricingMode;
  durationDays: number;
  basePriceCents: number;
  minGroupSize: number;
  maxGroupSize: number;
  kidFriendly: boolean;
  featured: boolean;
  heroImageUrl: string | null;
  highlights: string[];
  city: CityRef;
}

export type DayItemReference =
  | { kind: 'PLACE'; place: PlaceSummary }
  | { kind: 'HOTEL'; hotel: Hotel }
  | { kind: 'TRANSPORT'; transport: Transport }
  | { kind: 'GUIDE'; guide: Guide };

export interface DayItem {
  id: string;
  position: number;
  type: ItemType;
  refId: string | null;
  title: string;
  description: string;
  startTime: string | null;
  durationMinutes: number;
  priceCents: number;
  bookable: boolean;
  reference: DayItemReference | null;
}

export interface PackageDay {
  id: string;
  dayNumber: number;
  title: string;
  summary: string;
  items: DayItem[];
}

export interface PackageDetail extends Omit<PackageSummary, 'city'> {
  city: City;
  inclusions: string[];
  exclusions: string[];
  days: PackageDay[];
}
