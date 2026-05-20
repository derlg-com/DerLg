export interface TripSummary {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  durationDays: number;
  basePriceUsd: number;
  coverImage: string | null;
}
