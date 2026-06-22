export interface TripSummary {
  id: string;
  name: string;
  coverImageUrl: string | null;
  durationDays: number;
  priceUsd: number;
  category: string;
  /** Structured location not yet in schema — null for now. */
  location: string | null;
  /** Review aggregation pending — null/0 for now. */
  ratingAverage: number | null;
  ratingCount: number;
}
