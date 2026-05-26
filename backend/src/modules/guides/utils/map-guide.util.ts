import type { Prisma } from '@prisma/client';
import type { GuideSummary } from '../interfaces/guide-summary.interface';
import type { GuideDetail } from '../interfaces/guide-detail.interface';

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
  specialities: { speciality: string }[];
};

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapGuideSummary(row: GuideRow): GuideSummary {
  return {
    id: row.id,
    avatarUrl: row.avatarUrl,
    pricePerDayUsd: toNum(row.pricePerDayUsd),
    province: row.province,
    provinces: row.provinces,
    languages: row.languages.map((l) => l.language),
    specialities: row.specialities.map((s) => s.speciality),
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
    specialities: row.specialities.map((s) => s.speciality),
    isVerified: row.isVerified,
  };
}
