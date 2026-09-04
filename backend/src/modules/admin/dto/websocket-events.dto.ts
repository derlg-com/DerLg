export class DriverStatusUpdateEvent {
  event: 'DRIVER_STATUS_UPDATE';
  driverId: string;
  status: string;
  vehicleId?: string;
  timestamp: string;
}

export class BookingCreatedEvent {
  event: 'BOOKING_CREATED';
  bookingId: string;
  reference: string;
  userId: string;
  status: string;
  totalUsd: number;
  timestamp: string;
}

export class EmergencyAlertEvent {
  event: 'EMERGENCY_ALERT';
  alertId: string;
  alertType: string;
  severity: string;
  lat?: number;
  lng?: number;
  message?: string;
  timestamp: string;
}

export class DriverAssignmentEvent {
  event: 'DRIVER_ASSIGNMENT';
  assignmentId: string;
  driverId: string;
  bookingId: string;
  status: string;
  timestamp: string;
}
