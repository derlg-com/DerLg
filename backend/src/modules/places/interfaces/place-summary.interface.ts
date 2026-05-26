export interface PlaceSummary {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  entryFeeUsd: number | null;
  coverImage: string | null;
}
