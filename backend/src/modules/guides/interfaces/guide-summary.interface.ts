import type { TripCategory } from '@prisma/client';

export interface GuidePackage {
  id: string;
  name: string | null;
  coverImageUrl: string | null;
  durationDays: number;
  priceUsd: number;
  category: TripCategory;
  location: string | null;
}

export interface GuideSummary {
  id: string;
  avatarUrl: string | null;
  pricePerDayUsd: number;
  province: string;
  provinces: string[];
  languages: string[];
  specialties: string[];
  isVerified: boolean;
  /** Trips this guide runs (implicit m2m). Nullish until trips are seeded. */
  packages: GuidePackage[];
}
