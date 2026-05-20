export interface GuideDetail {
  id: string;
  bio: string | null;
  avatarUrl: string | null;
  images: string[];
  pricePerDayUsd: number;
  province: string;
  provinces: string[];
  languages: string[];
  specialities: string[];
  isVerified: boolean;
}
