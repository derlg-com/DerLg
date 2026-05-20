import type { Prisma } from '@prisma/client';
import type { Lang } from '../../../common/i18n';
import type { TripSummary } from '../interfaces/trip-summary.interface';
import type {
  TripDetail,
  ItineraryItem,
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
    title: t?.title ?? '',
    subtitle: t?.subtitle ?? null,
    category: row.category,
    durationDays: row.durationDays,
    basePriceUsd: toPrice(row.basePriceUsd),
    coverImage: row.coverImage,
  };
}

export function mapTripDetail(row: TripDetailRow, lang: Lang): TripDetail {
  const t = pickTranslation(row.translations, lang);
  const itinerary: ItineraryItem[] = row.itineraryItems.map((item) => {
    const it = pickTranslation(item.translations, lang);
    return {
      id: item.id,
      dayNumber: item.dayNumber,
      sortOrder: item.sortOrder,
      title: it?.title ?? '',
      description: it?.description ?? null,
    };
  });
  return {
    id: row.id,
    title: t?.title ?? '',
    subtitle: t?.subtitle ?? null,
    description: t?.description ?? null,
    category: row.category,
    durationDays: row.durationDays,
    basePriceUsd: toPrice(row.basePriceUsd),
    maxCapacity: row.maxCapacity,
    coverImage: row.coverImage,
    images: row.images,
    includedItems: t?.includedItems ?? [],
    excludedItems: t?.excludedItems ?? [],
    cancellationPolicy: t?.cancellationPolicy ?? null,
    meetingPoint: t?.meetingPoint ?? null,
    itinerary,
  };
}
