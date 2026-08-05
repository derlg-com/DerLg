import type { HotelType } from '@prisma/client';

export interface HotelSummary {
  id: string;
  name: string;
  address: string | null;
  type: HotelType | null;
  starRating: number | null;
  coverImage: string | null;
  latitude: number;
  longitude: number;
}
