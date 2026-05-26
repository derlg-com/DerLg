export interface PlaceDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  entryFeeUsd: number | null;
  openingHours: string | null;
  dressCode: string | null;
  website: string | null;
  visitorTips: string | null;
  address: string | null;
  images: string[];
}
