export interface RoomAvailability {
  id: string;
  roomType: string;
  maxOccupancy: number;
  priceUsd: number;
  amenities: string[];
  images: string[];
  available: boolean;
}
