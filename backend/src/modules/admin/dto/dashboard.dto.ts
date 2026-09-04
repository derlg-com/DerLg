export class BookingTrendDto {
  date: string;
  count: number;
}

export class PendingActionDto {
  unassignedBookings: number;
  upcomingMaintenance: number;
}

export class DashboardOverviewDto {
  totalBookingsToday: number;
  totalRevenueToday: number;
  activeDriversCount: number;
  bookingTrends: BookingTrendDto[];
  pendingActions: PendingActionDto;
  recentEmergencies: unknown[];
  driverSummary: Record<string, number>;
  upcomingBookings: unknown[];
}
