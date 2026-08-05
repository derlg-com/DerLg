import { Prisma } from '@prisma/client';

/**
 * Shared Prisma `select` shapes. Declaring them once keeps every query explicit
 * (no implicit full-row fetches) and guarantees the AI tool layer, the catalogue
 * API and the itinerary engine all see identical fields.
 */

export const CITY_SELECT = {
  id: true,
  slug: true,
  name: true,
  country: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.CitySelect;

export const PLACE_IMAGE_SELECT = {
  url: true,
  position: true,
  author: true,
  license: true,
  sourceUrl: true,
} satisfies Prisma.PlaceImageSelect;

export const PLACE_SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  category: true,
  latitude: true,
  longitude: true,
  entranceFeeCents: true,
  visitDurationMinutes: true,
  dailyCapacity: true,
  city: { select: { slug: true, name: true } },
  images: { select: PLACE_IMAGE_SELECT, orderBy: { position: 'asc' }, take: 1 },
} satisfies Prisma.PlaceSelect;

export const PLACE_DETAIL_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  latitude: true,
  longitude: true,
  entranceFeeCents: true,
  visitDurationMinutes: true,
  dailyCapacity: true,
  mapsUrl: true,
  city: { select: CITY_SELECT },
  images: { select: PLACE_IMAGE_SELECT, orderBy: { position: 'asc' } },
} satisfies Prisma.PlaceSelect;

export const HOTEL_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  address: true,
  starRating: true,
  pricePerNightCents: true,
  amenities: true,
  imageUrl: true,
  roomsPerNight: true,
  latitude: true,
  longitude: true,
  city: { select: { slug: true, name: true } },
} satisfies Prisma.HotelSelect;

export const TRANSPORT_SELECT = {
  id: true,
  slug: true,
  kind: true,
  operator: true,
  departureTime: true,
  durationMinutes: true,
  pricePerSeatCents: true,
  seatsPerDeparture: true,
  imageUrl: true,
  originCity: { select: { slug: true, name: true } },
  destinationCity: { select: { slug: true, name: true } },
} satisfies Prisma.TransportSelect;

export const GUIDE_SELECT = {
  id: true,
  slug: true,
  fullName: true,
  bio: true,
  languages: true,
  pricePerDayCents: true,
  rating: true,
  yearsExperience: true,
  avatarUrl: true,
  dailyCapacity: true,
  city: { select: { slug: true, name: true } },
} satisfies Prisma.GuideSelect;

export const PACKAGE_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  kind: true,
  pricingMode: true,
  durationDays: true,
  basePriceCents: true,
  minGroupSize: true,
  maxGroupSize: true,
  kidFriendly: true,
  featured: true,
  heroImageUrl: true,
  highlights: true,
  city: { select: { slug: true, name: true } },
} satisfies Prisma.PackageSelect;

export const PACKAGE_DETAIL_SELECT = {
  ...PACKAGE_SUMMARY_SELECT,
  city: { select: CITY_SELECT },
  inclusions: true,
  exclusions: true,
  days: {
    orderBy: { dayNumber: 'asc' },
    select: {
      id: true,
      dayNumber: true,
      title: true,
      summary: true,
      items: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          type: true,
          refId: true,
          title: true,
          description: true,
          startTime: true,
          durationMinutes: true,
          priceCents: true,
          bookable: true,
        },
      },
    },
  },
} satisfies Prisma.PackageSelect;

export type PlaceSummary = Prisma.PlaceGetPayload<{ select: typeof PLACE_SUMMARY_SELECT }>;
export type PlaceDetail = Prisma.PlaceGetPayload<{ select: typeof PLACE_DETAIL_SELECT }>;
export type HotelRecord = Prisma.HotelGetPayload<{ select: typeof HOTEL_SELECT }>;
export type TransportRecord = Prisma.TransportGetPayload<{ select: typeof TRANSPORT_SELECT }>;
export type GuideRecord = Prisma.GuideGetPayload<{ select: typeof GUIDE_SELECT }>;
export type PackageSummary = Prisma.PackageGetPayload<{ select: typeof PACKAGE_SUMMARY_SELECT }>;
export type PackageDetailRecord = Prisma.PackageGetPayload<{ select: typeof PACKAGE_DETAIL_SELECT }>;
export type CityRecord = Prisma.CityGetPayload<{ select: typeof CITY_SELECT }>;

/** A day item with its referenced catalogue row resolved for display. */
export interface ResolvedDayItem {
  id: string;
  position: number;
  type: 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'CUSTOM';
  refId: string | null;
  title: string;
  description: string;
  startTime: string | null;
  durationMinutes: number;
  priceCents: number;
  bookable: boolean;
  reference:
    | { kind: 'PLACE'; place: PlaceSummary }
    | { kind: 'HOTEL'; hotel: HotelRecord }
    | { kind: 'TRANSPORT'; transport: TransportRecord }
    | { kind: 'GUIDE'; guide: GuideRecord }
    | null;
}

export interface PackageDetail extends Omit<PackageDetailRecord, 'days'> {
  days: Array<{
    id: string;
    dayNumber: number;
    title: string;
    summary: string;
    items: ResolvedDayItem[];
  }>;
}
