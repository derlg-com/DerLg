import type { GuidePackage } from './guide-summary.interface';

export interface GuideDetail {
  id: string;
  bio: string | null;
  avatarUrl: string | null;
  images: string[];
  pricePerDayUsd: number;
  province: string;
  provinces: string[];
  languages: string[];
  specialties: string[];
  isVerified: boolean;
  packages: GuidePackage[];
}
