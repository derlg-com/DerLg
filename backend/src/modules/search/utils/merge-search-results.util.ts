import type { Prisma } from '@prisma/client';
import type {
  SearchHit,
  TripSearchHit,
  PlaceSearchHit,
  HotelSearchHit,
  GuideSearchHit,
} from '../interfaces/search-hit.interface';

type TripRow = {
  id: string;
  category: string;
  basePriceUsd: Prisma.Decimal | number;
  coverImage: string | null;
  translations: { title: string }[];
};

type PlaceRow = {
  id: string;
  category: string;
  images: string[];
  translations: { name: string }[];
};

type HotelRow = {
  id: string;
  starRating: number | null;
  images: string[];
  translations: { name: string }[];
};

type GuideRow = {
  id: string;
  avatarUrl: string | null;
  province: string;
  pricePerDayUsd: Prisma.Decimal | number;
};

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapTripHits(rows: TripRow[]): TripSearchHit[] {
  return rows.map((r) => ({
    id: r.id,
    kind: 'trip' as const,
    title: r.translations[0]?.title ?? '',
    image: r.coverImage,
    category: r.category,
    basePriceUsd: toNum(r.basePriceUsd),
  }));
}

export function mapPlaceHits(rows: PlaceRow[]): PlaceSearchHit[] {
  return rows.map((r) => ({
    id: r.id,
    kind: 'place' as const,
    title: r.translations[0]?.name ?? '',
    image: r.images[0] ?? null,
    category: r.category,
  }));
}

export function mapHotelHits(rows: HotelRow[]): HotelSearchHit[] {
  return rows.map((r) => ({
    id: r.id,
    kind: 'hotel' as const,
    title: r.translations[0]?.name ?? '',
    image: r.images[0] ?? null,
    starRating: r.starRating,
  }));
}

export function mapGuideHits(rows: GuideRow[]): GuideSearchHit[] {
  return rows.map((r) => ({
    id: r.id,
    kind: 'guide' as const,
    title: '', // Guides have no title — use empty string
    image: r.avatarUrl,
    province: r.province,
    pricePerDayUsd: toNum(r.pricePerDayUsd),
  }));
}

export function mergeSearchResults(
  trips: TripSearchHit[],
  places: PlaceSearchHit[],
  hotels: HotelSearchHit[],
  guides: GuideSearchHit[],
): SearchHit[] {
  return [...trips, ...places, ...hotels, ...guides];
}
