import type { Prisma } from '@prisma/client';
import type { Lang } from '../../../common/i18n';
import type { HotelSummary } from '../interfaces/hotel-summary.interface';
import type { HotelDetail } from '../interfaces/hotel-detail.interface';

type HotelTranslationRow = {
  language: string;
  name: string;
  address: string | null;
  description?: string | null;
};

export type HotelSummaryRow = {
  id: string;
  starRating: number | null;
  images: string[];
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  translations: HotelTranslationRow[];
};

export type HotelDetailRow = HotelSummaryRow & {
  amenities: string[];
  translations: (HotelTranslationRow & { description: string | null })[];
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

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapHotelSummary(
  row: HotelSummaryRow,
  lang: Lang,
): HotelSummary {
  const t = pickTranslation(row.translations, lang);
  return {
    id: row.id,
    name: t?.name ?? '',
    address: t?.address ?? null,
    starRating: row.starRating,
    coverImage: row.images[0] ?? null,
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
  };
}

export function mapHotelDetail(row: HotelDetailRow, lang: Lang): HotelDetail {
  const t = pickTranslation(row.translations, lang);
  return {
    id: row.id,
    name: t?.name ?? '',
    address: t?.address ?? null,
    description: t?.description ?? null,
    starRating: row.starRating,
    images: row.images,
    amenities: row.amenities,
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
  };
}
