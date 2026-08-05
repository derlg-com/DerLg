import type { HotelType } from '@prisma/client';

export interface HotelDetail {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  type: HotelType | null;
  starRating: number | null;
  images: string[];
  amenities: string[];
  latitude: number;
  longitude: number;
  /** Cheapest active room price (per night, USD); null when no active rooms. */
  priceFromUsd: number | null;
}
