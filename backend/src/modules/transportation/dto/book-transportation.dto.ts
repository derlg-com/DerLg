export interface BookTransportationDto {
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  stops?: string[];
  estimatedDistanceKm?: number;
  specialRequests?: string;
}
