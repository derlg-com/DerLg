import type { Prisma, TripCategory } from '@prisma/client';
import type { GuideSummary } from '../interfaces/guide-summary.interface';
import type { GuideDetail } from '../interfaces/guide-detail.interface';

export type GuideTripRow = {
  id: string;
  durationDays: number;
  basePriceUsd: Prisma.Decimal | number;
  coverImage: string | null;
  category: TripCategory;
  translations: { title: string }[];
};

export type GuideRow = {
  id: string;
  bio: string | null;
  avatarUrl: string | null;
  images: string[];
  pricePerDayUsd: Prisma.Decimal | number;
  province: string;
  provinces: string[];
  isVerified: boolean;
  languages: { language: string }[];
  specialties: { specialty: string }[];
  trips: GuideTripRow[];
};

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

function mapPackages(row: GuideRow): GuideSummary['packages'] {
  return row.trips.map((t) => ({
    id: t.id,
    name: t.translations[0]?.title ?? null,
    coverImageUrl: t.coverImage ?? null,
    durationDays: t.durationDays,
    priceUsd: toNum(t.basePriceUsd),
    category: t.category,
    location: null, // Trip has no structured location column yet
  }));
}

export function mapGuideSummary(row: GuideRow): GuideSummary {
  return {
    id: row.id,
    avatarUrl: row.avatarUrl,
    pricePerDayUsd: toNum(row.pricePerDayUsd),
    province: row.province,
    provinces: row.provinces,
    languages: row.languages.map((l) => l.language),
    specialties: row.specialties.map((s) => s.specialty),
    packages: mapPackages(row),
    isVerified: row.isVerified,
  };
}

export function mapGuideDetail(row: GuideRow): GuideDetail {
  return {
    id: row.id,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    images: row.images,
    pricePerDayUsd: toNum(row.pricePerDayUsd),
    province: row.province,
    provinces: row.provinces,
    languages: row.languages.map((l) => l.language),
    specialties: row.specialties.map((s) => s.specialty),
    packages: mapPackages(row),
    isVerified: row.isVerified,
  };
}
