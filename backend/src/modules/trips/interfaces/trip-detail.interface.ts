export interface ItineraryItem {
  id: string;
  dayNumber: number;
  sortOrder: number;
  title: string;
  description: string | null;
}

export interface TripDetail {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string;
  durationDays: number;
  basePriceUsd: number;
  maxCapacity: number;
  coverImage: string | null;
  images: string[];
  includedItems: string[];
  excludedItems: string[];
  cancellationPolicy: string | null;
  meetingPoint: string | null;
  itinerary: ItineraryItem[];
}
