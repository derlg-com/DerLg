import { Injectable, Logger } from '@nestjs/common';
import { AdminRole, DriverStatus } from '@prisma/client';

import { RedisService } from '../../redis/redis.service';

/**
 * Publishes admin-facing events onto Redis.
 *
 * Everything real-time flows through pub/sub rather than being emitted straight
 * at the WebSocket server, so an event raised by any process — the HTTP API, a
 * Telegram webhook, or a queue worker — reaches every connected admin regardless
 * of which instance holds their socket.
 *
 * Publishing never throws. A dropped notification must not fail the mutation
 * that triggered it: a driver assignment that succeeded in the database but
 * failed to notify is still a successful assignment.
 */
@Injectable()
export class AdminEventsService {
  private readonly logger = new Logger(AdminEventsService.name);

  constructor(private readonly redis: RedisService) {}

  private async publish(channel: string, payload: unknown): Promise<void> {
    try {
      await this.redis.getClient().publish(channel, JSON.stringify(payload));
    } catch (error) {
      this.logger.warn('Failed to publish admin event', {
        channel,
        error: (error as Error).message,
      });
    }
  }

  /** Driver went online/offline/busy. */
  driverStatusChanged(input: {
    driverId: string;
    driverName: string;
    status: DriverStatus;
    vehicleId: string | null;
  }): Promise<void> {
    return this.publish(`driver_status_changed:${input.driverId}`, input);
  }

  /** A driver was offered, accepted, or completed a booking. */
  driverAssignment(input: {
    assignmentId: string;
    driverId: string;
    bookingId: string;
    status: string;
  }): Promise<void> {
    return this.publish('driver_assignments', input);
  }

  /**
   * SOS / medical / theft / lost alert.
   *
   * Carries a live location, so the gateway restricts delivery to
   * OPERATIONS_MANAGER and SUPER_ADMIN.
   */
  emergencyAlert(input: {
    alertId: string;
    alertType: string;
    status: string;
    latitude: number;
    longitude: number;
    userId: string;
    driverId: string | null;
  }): Promise<void> {
    return this.publish('emergency_alerts', input);
  }

  /** General operational event: booking created, payment received, etc. */
  adminEvent(input: {
    type: string;
    entityType: string;
    entityId: string;
    summary?: string;
  }): Promise<void> {
    return this.publish('admin_events', input);
  }

  /** Roles that receive a given event class; mirrored by AdminGateway. */
  static audienceFor(event: string): AdminRole[] {
    switch (event) {
      case 'EMERGENCY_ALERT':
        return [AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN];
      case 'DRIVER_STATUS_UPDATE':
      case 'DRIVER_ASSIGNMENT':
        return [
          AdminRole.FLEET_MANAGER,
          AdminRole.OPERATIONS_MANAGER,
          AdminRole.SUPER_ADMIN,
        ];
      default:
        return [
          AdminRole.SUPPORT_AGENT,
          AdminRole.FLEET_MANAGER,
          AdminRole.OPERATIONS_MANAGER,
          AdminRole.SUPER_ADMIN,
        ];
    }
  }
}
