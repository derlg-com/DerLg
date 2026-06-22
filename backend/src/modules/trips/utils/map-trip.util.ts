import type { Prisma } from '@prisma/client';
import type { Lang } from '../../../common/i18n';
import type { TripSummary } from '../interfaces/trip-summary.interface';
import type {
  TripDetail,
  ItineraryDay,
} from '../interfaces/trip-detail.interface';

// Minimal translation shape shared between summary and detail queries
type TranslationBase = {
  language: string;
  title: string;
  subtitle?: string | null;
};

type TranslationDetail = TranslationBase & {
  description?: string | null;
  includedItems?: string[];
  excludedItems?: string[];
  cancellationPolicy?: string | null;
  meetingPoint?: string | null;
};

export type TripSummaryRow = {
  id: string;
  category: string;
  durationDays: number;
  basePriceUsd: Prisma.Decimal | number;
  coverImage: string | null;
  images?: string[];
  maxCapacity?: number;
  translations: TranslationBase[];
};

export type ItineraryItemRow = {
  id: string;
  dayNumber: number;
  sortOrder: number;
  translations: Array<{
    language: string;
    title: string;
    description: string | null;
  }>;
};

export type TripDetailRow = TripSummaryRow & {
  maxCapacity: number;
  images: string[];
  translations: TranslationDetail[];
  itineraryItems: ItineraryItemRow[];
};

function pickTranslation<T extends { language: string }>(
  translations: T[],
  lang: Lang,
): T | undefined {
  return (
    translations.find((t) => t.language === lang) ??
    translations.find((t) => t.language === 'en')
  );
}

function toPrice(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapTripSummary(row: TripSummaryRow, lang: Lang): TripSummary {
  const t = pickTranslation(row.translations, lang);
  return {
    id: row.id,
    name: t?.title ?? '',
    coverImageUrl: row.coverImage,
    durationDays: row.durationDays,
    priceUsd: toPrice(row.basePriceUsd),
    category: row.category,
    // Structured location + review aggregation are not modeled yet; the
    // frontend guards these (null/0) — tracked as a follow-up.
    location: null,
    ratingAverage: null,
    ratingCount: 0,
  };
}

export function mapTripDetail(row: TripDetailRow, lang: Lang): TripDetail {
  const t = pickTranslation(row.translations, lang);
  const itineraryDays: ItineraryDay[] = row.itineraryItems.map((item) => {
    const it = pickTranslation(item.translations, lang);
    return {
      dayNumber: item.dayNumber,
      title: it?.title ?? '',
      description: it?.description ?? null,
    };
  });
  return {
    ...mapTripSummary(row, lang),
    description: t?.description ?? null,
    galleryImageUrls: row.images,
    itineraryDays,
    includedItems: t?.includedItems ?? [],
    excludedItems: t?.excludedItems ?? [],
    // Meeting-point coordinates are not modeled yet (translation stores only a
    // text description); null until a schema field lands — tracked as follow-up.
    meetingPoint: null,
    cancellationPolicy: t?.cancellationPolicy ?? null,
    maxGuests: row.maxCapacity,
  };
}
