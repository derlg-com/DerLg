import type { Prisma } from '@prisma/client';
import type { Lang } from '../../../common/i18n';
import type { PlaceSummary } from '../interfaces/place-summary.interface';
import type { PlaceDetail } from '../interfaces/place-detail.interface';

type TranslationBase = {
  language: string;
  name: string;
  description?: string | null;
  visitorTips?: string | null;
  address?: string | null;
};

export type PlaceSummaryRow = {
  id: string;
  category: string;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  entryFeeUsd: Prisma.Decimal | number | null;
  images: string[];
  translations: TranslationBase[];
};

export type PlaceDetailRow = PlaceSummaryRow & {
  openingHours: string | null;
  dressCode: string | null;
  website: string | null;
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

function toNum(val: Prisma.Decimal | number | null): number | null {
  if (val === null) return null;
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapPlaceSummary(
  row: PlaceSummaryRow,
  lang: Lang,
): PlaceSummary {
  const t = pickTranslation(row.translations, lang);
  return {
    id: row.id,
    name: t?.name ?? '',
    category: row.category,
    latitude: toNum(row.latitude) as number,
    longitude: toNum(row.longitude) as number,
    entryFeeUsd: toNum(row.entryFeeUsd),
    coverImage: row.images[0] ?? null,
  };
}

export function mapPlaceDetail(row: PlaceDetailRow, lang: Lang): PlaceDetail {
  const t = pickTranslation(row.translations, lang);
  return {
    id: row.id,
    name: t?.name ?? '',
    description: t?.description ?? null,
    category: row.category,
    latitude: toNum(row.latitude) as number,
    longitude: toNum(row.longitude) as number,
    entryFeeUsd: toNum(row.entryFeeUsd),
    openingHours: row.openingHours,
    dressCode: row.dressCode,
    website: row.website,
    visitorTips: t?.visitorTips ?? null,
    address: t?.address ?? null,
    images: row.images,
  };
}
