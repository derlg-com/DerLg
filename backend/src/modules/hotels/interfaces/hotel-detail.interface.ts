export interface HotelDetail {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  starRating: number | null;
  images: string[];
  amenities: string[];
  latitude: number;
  longitude: number;
}
