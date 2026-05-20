export interface GuideSummary {
  id: string;
  avatarUrl: string | null;
  pricePerDayUsd: number;
  province: string;
  provinces: string[];
  languages: string[];
  specialities: string[];
  isVerified: boolean;
}
