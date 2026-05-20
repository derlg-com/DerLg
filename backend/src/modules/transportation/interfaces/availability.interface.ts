export interface BusyRange {
  from: string; // ISO date
  to: string; // ISO date
}

export interface VehicleAvailability {
  vehicleId: string;
  busyRanges: BusyRange[];
}
