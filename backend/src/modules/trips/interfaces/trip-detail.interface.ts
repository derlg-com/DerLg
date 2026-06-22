import type { TripSummary } from './trip-summary.interface';

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  description: string | null;
  durationHours?: number;
}

export interface MeetingPoint {
  description: string;
  latitude: number;
  longitude: number;
}

export interface TripDetail extends TripSummary {
  description: string | null;
  galleryImageUrls: string[];
  itineraryDays: ItineraryDay[];
  includedItems: string[];
  excludedItems: string[];
  meetingPoint: MeetingPoint | null;
  cancellationPolicy: string | null;
  maxGuests: number | null;
}
