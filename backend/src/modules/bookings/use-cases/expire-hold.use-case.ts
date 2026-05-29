import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReleaseHoldUtil, assertTransition } from '../utils';
import type { BookingExpiredEvent } from '../interfaces';

/**
 * Phase 8's BookingCleanupJob will call this every 5 minutes via @Cron.
 * Finds stale HOLD rows (expiresAt < now), transitions them to expired,
 * releases their Redis hold key, and emits booking.expired so listeners
 * (notifications, downstream cleanup) can react.
 *
 * Race-tolerant: if assertTransition rejects (e.g. another worker already
 * transitioned the row), skip the row and move on — no error surfaces.
 */
@Injectable()
export class ExpireHoldUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly releaseHold: ReleaseHoldUtil,
    private readonly events: EventEmitter2,
  ) {}

  async execute(): Promise<{ expired: number }> {
    const now = new Date();
    const stale = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.hold,
        expiresAt: { lt: now },
        deletedAt: null,
      },
    });

    let count = 0;
    for (const booking of stale) {
      try {
        assertTransition(booking.status, BookingStatus.expired);
      } catch {
        continue;
      }
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.expired },
      });
      await this.releaseHold.release(booking.id);
      const event: BookingExpiredEvent = {
        bookingId: booking.id,
        userId: booking.userId,
        reference: booking.reference,
        expiredAt: now.toISOString(),
      };
      this.events.emit('booking.expired', event);
      count++;
    }
    return { expired: count };
  }
}
