import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Shape returned by `getDashboardOverview` before role filtering. */
export interface DashboardOverview {
  totalBookingsToday: number;
  totalRevenueToday: number;
  activeDriversCount: number;
  bookingTrends: unknown;
  driverSummary: unknown;
  /**
   * Counts the panels act on. Each key is optional because the role filter
   * returns only the subset a role may see.
   */
  pendingActions: {
    unassignedBookings?: number;
    upcomingMaintenance?: number;
    pendingVerifications?: number;
  };
  recentEmergencies: unknown;
  upcomingBookings: unknown;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardOverview(role?: AdminRole) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const twentyFourHoursLater = new Date();
    twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);

    const [
      totalBookingsToday,
      totalRevenueToday,
      activeDrivers,
      bookingTrendsRaw,
      unassignedBookings,
      upcomingMaintenance,
      recentEmergencies,
      driverSummary,
      upcomingBookings,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.booking.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalUsd: true },
      }),
      this.prisma.driver.count({
        where: { status: { in: ['AVAILABLE', 'BUSY'] } },
      }),
      this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM bookings
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      this.getUnassignedBookingsCount(),
      this.prisma.vehicleMaintenance.count({
        where: {
          scheduledDate: { gte: today, lte: nextWeek },
          status: 'SCHEDULED',
        },
      }),
      this.prisma.emergencyAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { email: true, fullName: true } },
        },
      }),
      this.prisma.driver.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.booking.findMany({
        where: {
          startDate: { gte: new Date(), lte: twentyFourHoursLater },
          status: { not: 'cancelled' },
        },
        include: {
          user: { select: { email: true, fullName: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 10,
      }),
    ]);

    const bookingTrends = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const row = bookingTrendsRaw.find(
        (r) => r.date.toISOString().split('T')[0] === dateStr,
      );
      return { date: dateStr, count: Number(row?.count || 0) };
    });

    const driverAvailabilitySummary = {
      AVAILABLE: 0,
      BUSY: 0,
      OFFLINE: 0,
    };
    for (const s of driverSummary) {
      driverAvailabilitySummary[s.status] = s._count._all;
    }

    const overview = {
      totalBookingsToday: totalBookingsToday,
      totalRevenueToday: Number(totalRevenueToday._sum.totalUsd || 0),
      activeDriversCount: activeDrivers,
      bookingTrends: bookingTrends,
      pendingActions: {
        unassignedBookings: unassignedBookings,
        upcomingMaintenance: upcomingMaintenance,
      },
      recentEmergencies: recentEmergencies.map((e) => ({
        id: e.id,
        alertType: e.alertType,
        status: e.status,
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
        user: e.user,
        createdAt: e.createdAt,
      })),
      driverSummary: driverAvailabilitySummary,
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        startDate: b.startDate,
        endDate: b.endDate,
        status: b.status,
        totalUsd: Number(b.totalUsd),
        user: b.user,
        passengerCount: b.passengerCount,
      })),
    };

    return this.filterByRole(overview, role);
  }

  private async getUnassignedBookingsCount(): Promise<number> {
    const assigned = await this.prisma.driverAssignment.findMany({
      where: { status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { bookingId: true },
    });
    const assignedIds = assigned.map((a) => a.bookingId);

    if (assignedIds.length === 0) {
      return this.prisma.booking.count({
        where: { status: { not: 'cancelled' } },
      });
    }

    return this.prisma.booking.count({
      where: {
        id: { notIn: assignedIds },
        status: { not: 'cancelled' },
      },
    });
  }

  /**
   * Narrows the dashboard to what a role is allowed to see.
   *
   * FLEET_MANAGER has no analytics access and SUPPORT_AGENT has no fleet access,
   * so each gets a subset rather than the full payload — the panels a role
   * cannot open should not arrive in the response either.
   */
  private filterByRole(
    overview: DashboardOverview,
    role?: AdminRole,
  ): Partial<DashboardOverview> {
    if (!role || role === AdminRole.SUPER_ADMIN) {
      return overview;
    }

    if (role === AdminRole.FLEET_MANAGER) {
      return {
        activeDriversCount: overview.activeDriversCount,
        driverSummary: overview.driverSummary,
        pendingActions: {
          upcomingMaintenance: overview.pendingActions.upcomingMaintenance,
        },
        recentEmergencies: overview.recentEmergencies,
      };
    }

    if (role === AdminRole.SUPPORT_AGENT) {
      return {
        totalBookingsToday: overview.totalBookingsToday,
        totalRevenueToday: overview.totalRevenueToday,
        bookingTrends: overview.bookingTrends,
        pendingActions: {
          unassignedBookings: overview.pendingActions.unassignedBookings,
        },
        upcomingBookings: overview.upcomingBookings,
      };
    }

    // OPERATIONS_MANAGER gets everything
    return overview;
  }
}
