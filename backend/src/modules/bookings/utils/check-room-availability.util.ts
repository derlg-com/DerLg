import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Per-night inventory counter for hotel-room availability.
 *
 * Returns true if at least one room is free for every night in
 * `[checkInDate, checkOutDate)` — i.e. no night already has
 * `booked >= totalRooms`.
 *
 * Uses raw SQL because Prisma does not expose `generate_series`. Runs
 * inside the caller's transaction so it sees pending writes.
 */
@Injectable()
export class CheckRoomAvailabilityUtil {
  async isAvailable(
    tx: Prisma.TransactionClient,
    args: {
      hotelRoomId: string;
      totalRooms: number;
      checkInDate: Date;
      checkOutDate: Date;
    },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ night: Date; booked: bigint }>>`
      WITH date_series AS (
        SELECT generate_series(
          ${args.checkInDate}::date,
          ${args.checkOutDate}::date - interval '1 day',
          '1 day'
        )::date AS night
      )
      SELECT ds.night, COUNT(bi.id)::bigint AS booked
      FROM date_series ds
      LEFT JOIN booking_items bi
        ON bi.hotel_room_id = ${args.hotelRoomId}::uuid
        AND bi.start_date <= ds.night
        AND bi.end_date > ds.night
      LEFT JOIN bookings b
        ON b.id = bi.booking_id
        AND b.status IN ('hold', 'pending_payment', 'confirmed')
        AND b.deleted_at IS NULL
      GROUP BY ds.night
      HAVING COUNT(bi.id) >= ${args.totalRooms}
    `;

    return rows.length === 0;
  }
}
