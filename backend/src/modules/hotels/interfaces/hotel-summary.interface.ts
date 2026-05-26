export interface HotelSummary {
  id: string;
  name: string;
  address: string | null;
  starRating: number | null;
  coverImage: string | null;
  latitude: number;
  longitude: number;
}
