export interface BusyRange {
  from: string; // ISO date
  to: string; // ISO date
}

export interface GuideAvailability {
  guideId: string;
  busyRanges: BusyRange[];
}
