import { randomBytes } from 'node:crypto';

import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, ItemType, Prisma } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AvailabilityService } from '../availability/availability.service';
import {
  addDays,
  toDateOnly,
  unitsFor,
} from '../availability/interfaces/availability.interface';
import { PricingService } from '../availability/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CatalogRefResolver } from '../catalog/catalog-ref.resolver';
import { JourneyDraftsService } from '../journeys/journey-drafts.service';
import { DraftSnapshot } from '../journeys/interfaces/journey-draft.interface';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingSnapshot,
  BookingView,
  CANCELLABLE_STATUSES,
  HOLD_DURATION_SECONDS,
  formatReference,
  holdKey,
} from './interfaces/booking.interface';

const BOOKING_SELECT = {
  id: true,
  reference: true,
  userId: true,
  status: true,
  startDate: true,
  endDate: true,
  guests: true,
  totalCents: true,
  currency: true,
  contactName: true,
  contactEmail: true,
  packageId: true,
  draftId: true,
  checkInCode: true,
  holdExpiresAt: true,
  confirmedAt: true,
  cancelledAt: true,
  snapshot: true,
  createdAt: true,
  updatedAt: true,
  package: { select: { slug: true } },
  items: {
    orderBy: [{ dayNumber: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      dayNumber: true,
      type: true,
      refId: true,
      title: true,
      date: true,
      quantity: true,
      unitPriceCents: true,
      totalCents: true,
      bookable: true,
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      provider: true,
      refundedCents: true,
    },
  },
} satisfies Prisma.BookingSelect;

type BookingRecord = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
    private readonly refs: CatalogRefResolver,
    private readonly drafts: JourneyDraftsService,
  ) {}

  /**
   * Creates a HOLD.
   *
   * The whole thing runs in one transaction that takes a row lock on every
   * contended resource before re-checking availability, so two travellers
   * racing for the last seat cannot both succeed. The Redis key is only written
   * after the transaction commits — it is a countdown for the UI, never the
   * authority on whether stock is held.
   */
  async create(
    userId: string,
    contact: { name: string; email: string },
    dto: CreateBookingDto,
  ): Promise<BookingView> {
    const plan = await this.resolvePlan(userId, dto);

    // Stock check: is everything still available on those dates?
    await this.availability.confirm({
      startDate: plan.startDate,
      guests: plan.guests,
      packageId: plan.packageId ?? undefined,
      items: plan.items.map((item) => ({
        dayNumber: item.dayNumber,
        type: item.type,
        refId: item.refId ?? undefined,
        title: item.title,
        bookable: item.bookable,
        extraPriceCents: item.extraPriceCents,
        itemKey: item.itemKey,
      })),
    });

    // Price: computed here rather than taken from the availability response,
    // because only this call knows the draft's original template items and
    // therefore the customisation delta. The client never supplies an amount.
    const basis = await this.availability.pricingBasisFor(plan.packageId);
    const quote = await this.pricing.quoteWithLookup({
      guests: plan.guests,
      items: plan.items,
      basis,
      templateItems: plan.snapshot.templateItems.map((item) => ({ ...item })),
    });

    const start = new Date(`${plan.startDate}T00:00:00.000Z`);
    const dayCount = plan.snapshot.days.length;
    const end = addDays(start, Math.max(0, dayCount - 1));

    const resolved = await this.refs.resolve(
      plan.items.map((item) => ({ type: item.type, refId: item.refId })),
    );

    const snapshot: BookingSnapshot = {
      title: plan.title,
      packageSlug: plan.packageSlug,
      days: plan.snapshot.days,
      price: {
        baseCents: quote.baseCents,
        itemsCents: quote.itemsCents,
        templateItemsCents: quote.templateItemsCents,
        deltaCents: quote.deltaCents,
        totalCents: quote.totalCents,
        currency: 'USD',
        lines: quote.lines,
      },
    };

    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);

    const created = await this.prisma.$transaction(
      async (tx) => {
        // Lock the contended catalogue rows for the duration of the transaction.
        // Any concurrent booking touching the same resources waits here, so the
        // availability re-check below cannot be undercut mid-flight.
        await this.lockResources(tx, plan.items);

        const shortfall = await this.findShortfall(tx, plan, start);
        if (shortfall.length > 0) {
          throw new AppException(
            ErrorCode.AVAILABILITY_UNAVAILABLE,
            'Someone just took the last of something in this trip.',
            HttpStatus.CONFLICT,
            { items: shortfall },
          );
        }

        const reference = await this.nextReference(tx);

        return tx.booking.create({
          data: {
            reference,
            userId,
            packageId: plan.packageId,
            draftId: plan.draftId,
            status: BookingStatus.HOLD,
            startDate: start,
            endDate: end,
            guests: plan.guests,
            totalCents: quote.totalCents,
            currency: 'USD',
            contactName: contact.name,
            contactEmail: contact.email,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            holdExpiresAt,
            items: {
              create: plan.items
                .filter((item) => item.bookable && item.type !== ItemType.CUSTOM && item.refId)
                .map((item) => {
                  const quantity = unitsFor(item.type, plan.guests);
                  const unitPriceCents =
                    this.refs.unitPriceCents(item.type, item.refId, resolved) +
                    (item.extraPriceCents ?? 0);
                  return {
                    dayNumber: item.dayNumber,
                    type: item.type,
                    refId: item.refId,
                    title: item.title,
                    date: new Date(`${toDateOnly(addDays(start, item.dayNumber - 1))}T00:00:00.000Z`),
                    quantity,
                    unitPriceCents,
                    totalCents: unitPriceCents * quantity,
                    bookable: true,
                  };
                }),
            },
          },
          select: BOOKING_SELECT,
        });
      },
      {
        /*
         * Read-committed is correct here *because* of the explicit
         * `SELECT ... FOR UPDATE` above: the second concurrent booking blocks on
         * those locks, then re-reads and sees the winner's rows, so it reports a
         * clean 409. Serializable would instead abort it with a serialization
         * failure, which surfaces to the traveller as a meaningless 500.
         */
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15_000,
      },
    ).catch((error: unknown) => {
      // Defence in depth: a write conflict or deadlock still means "someone
      // else got there first", not "the server broke".
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new AppException(
          ErrorCode.AVAILABILITY_UNAVAILABLE,
          'Someone just took the last of something in this trip. Please try again.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    });

    // TTL mirrors holdExpiresAt so the sweeper and the UI agree.
    await this.redis.set(holdKey(created.id), { reference: created.reference }, HOLD_DURATION_SECONDS);

    this.logger.log('Booking hold created', {
      bookingId: created.id,
      reference: created.reference,
      userId,
      totalCents: created.totalCents,
    });

    return this.toView(created);
  }

  async findAll(userId: string): Promise<BookingView[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      select: BOOKING_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return bookings.map((booking) => this.toView(booking));
  }

  async findOne(userId: string, bookingId: string): Promise<BookingView> {
    return this.toView(await this.loadOwned(userId, bookingId));
  }

  /** Cancels a booking, releasing its inventory immediately. */
  async cancel(userId: string, bookingId: string): Promise<BookingView> {
    const booking = await this.loadOwned(userId, bookingId);

    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new AppException(
        ErrorCode.BOOKING_INVALID_STATE,
        `A ${booking.status.toLowerCase().replace('_', ' ')} booking cannot be cancelled.`,
        HttpStatus.CONFLICT,
        { status: booking.status },
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        holdExpiresAt: null,
      },
      select: BOOKING_SELECT,
    });

    await this.redis.del(holdKey(booking.id));
    this.logger.log('Booking cancelled', { bookingId: booking.id, userId });

    return this.toView(updated);
  }

  /**
   * Expires every hold whose window has closed. Driven by the scheduler, but
   * safe to call at any time: it is idempotent and only touches lapsed rows.
   */
  async expireLapsedHolds(now: Date = new Date()): Promise<number> {
    const lapsed = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.HOLD, BookingStatus.PENDING_PAYMENT] },
        holdExpiresAt: { lte: now },
      },
      select: { id: true, reference: true },
    });

    if (lapsed.length === 0) {
      return 0;
    }

    await this.prisma.booking.updateMany({
      where: { id: { in: lapsed.map((booking) => booking.id) } },
      data: { status: BookingStatus.EXPIRED, holdExpiresAt: null },
    });

    await this.redis.del(...lapsed.map((booking) => holdKey(booking.id)));

    this.logger.log(`Expired ${lapsed.length} lapsed booking hold(s)`, {
      references: lapsed.map((booking) => booking.reference),
    });

    return lapsed.length;
  }

  /** Used by the payments module to move a hold into the payment stage. */
  async markPendingPayment(bookingId: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PENDING_PAYMENT },
    });
  }

  /** Used by the payments module once Stripe confirms the charge. */
  async markConfirmed(bookingId: string): Promise<BookingView> {
    const confirmed = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date(),
        holdExpiresAt: null,
        checkInCode: this.generateCheckInCode(),
      },
      select: BOOKING_SELECT,
    });

    await this.redis.del(holdKey(bookingId));
    this.logger.log('Booking confirmed', {
      bookingId,
      reference: confirmed.reference,
    });

    return this.toView(confirmed);
  }

  async loadOwned(userId: string, bookingId: string): Promise<BookingRecord> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: BOOKING_SELECT,
    });

    if (!booking) {
      throw new NotFoundException('That booking does not exist.');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('That booking belongs to someone else.');
    }
    return booking;
  }

  toView(booking: BookingRecord): BookingView {
    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    const secondsRemaining = booking.holdExpiresAt
      ? Math.max(0, Math.floor((booking.holdExpiresAt.getTime() - Date.now()) / 1000))
      : null;

    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      startDate: toDateOnly(booking.startDate),
      endDate: toDateOnly(booking.endDate),
      guests: booking.guests,
      totalCents: booking.totalCents,
      currency: booking.currency,
      contactName: booking.contactName,
      contactEmail: booking.contactEmail,
      packageId: booking.packageId,
      packageSlug: booking.package?.slug ?? null,
      draftId: booking.draftId,
      checkInCode: booking.checkInCode,
      holdExpiresAt: booking.holdExpiresAt,
      secondsRemaining,
      confirmedAt: booking.confirmedAt,
      cancelledAt: booking.cancelledAt,
      snapshot,
      items: booking.items.map((item) => ({
        id: item.id,
        dayNumber: item.dayNumber,
        type: item.type,
        refId: item.refId,
        title: item.title,
        date: toDateOnly(item.date),
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents,
        bookable: item.bookable,
      })),
      payment: booking.payments[0] ?? null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  // ------------------------------------------------------------- internals

  /** Normalises "book this draft" and "book this package" into one plan. */
  private async resolvePlan(userId: string, dto: CreateBookingDto) {
    if (dto.draftId) {
      const draft = await this.drafts.findOne(userId, dto.draftId);
      const startDate = dto.startDate ?? draft.startDate;

      if (!startDate) {
        throw new AppException(
          ErrorCode.VALIDATION_FAILED,
          'Choose a start date before booking.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const record = await this.prisma.journeyDraft.findUniqueOrThrow({
        where: { id: dto.draftId },
        select: { snapshot: true, packageId: true, title: true, guests: true },
      });
      const snapshot = record.snapshot as unknown as DraftSnapshot;

      return {
        draftId: dto.draftId,
        packageId: record.packageId,
        packageSlug: draft.packageSlug,
        title: record.title,
        guests: dto.guests ?? record.guests,
        startDate,
        snapshot,
        items: JourneyDraftsService.toPriceableItems(snapshot),
      };
    }

    if (!dto.startDate) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'A start date is required to book a package.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Booking a package as-is: build a throwaway draft snapshot from the
    // template so both paths share one pricing and inventory code path.
    const draft = await this.drafts.create(userId, {
      packageId: dto.packageId,
      packageSlug: dto.packageSlug,
      startDate: dto.startDate,
      guests: dto.guests,
    });

    const record = await this.prisma.journeyDraft.findUniqueOrThrow({
      where: { id: draft.id },
      select: { snapshot: true, packageId: true, title: true, guests: true },
    });
    const snapshot = record.snapshot as unknown as DraftSnapshot;

    return {
      draftId: draft.id,
      packageId: record.packageId,
      packageSlug: draft.packageSlug,
      title: record.title,
      guests: dto.guests ?? record.guests,
      startDate: dto.startDate,
      snapshot,
      items: JourneyDraftsService.toPriceableItems(snapshot),
    };
  }

  /**
   * Takes `SELECT ... FOR UPDATE` locks on the contended catalogue rows, in a
   * stable order (sorted ids) so two concurrent bookings can never deadlock by
   * grabbing the same pair in opposite orders.
   */
  private async lockResources(
    tx: Prisma.TransactionClient,
    items: Array<{ type: ItemType; refId: string | null; bookable: boolean }>,
  ): Promise<void> {
    const byTable = new Map<string, string[]>([
      ['hotels', []],
      ['transports', []],
      ['guides', []],
      ['places', []],
    ]);

    for (const item of items) {
      if (!item.bookable || !item.refId || item.type === ItemType.CUSTOM) {
        continue;
      }
      const table =
        item.type === ItemType.HOTEL
          ? 'hotels'
          : item.type === ItemType.TRANSPORT
            ? 'transports'
            : item.type === ItemType.GUIDE
              ? 'guides'
              : 'places';
      byTable.get(table)!.push(item.refId);
    }

    for (const [table, ids] of byTable) {
      const unique = [...new Set(ids)].sort();
      if (unique.length === 0) {
        continue;
      }
      // Table names come from the fixed map above, never from user input.
      await tx.$queryRawUnsafe(
        `SELECT id FROM "${table}" WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        unique,
      );
    }
  }

  /** Re-counts inventory inside the transaction and reports anything short. */
  private async findShortfall(
    tx: Prisma.TransactionClient,
    plan: { guests: number; items: Array<{ dayNumber: number; type: ItemType; refId: string | null; bookable: boolean; title: string }> },
    start: Date,
  ) {
    const bookable = plan.items.filter(
      (item) => item.bookable && item.refId && item.type !== ItemType.CUSTOM,
    );
    if (bookable.length === 0) {
      return [];
    }

    const dates = [
      ...new Set(bookable.map((item) => toDateOnly(addDays(start, item.dayNumber - 1)))),
    ].map((date) => new Date(`${date}T00:00:00.000Z`));

    const grouped = await tx.bookingItem.groupBy({
      by: ['type', 'refId', 'date'],
      where: {
        refId: { in: bookable.map((item) => item.refId!) },
        date: { in: dates },
        bookable: true,
        booking: { status: { in: ['HOLD', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] } },
      },
      _sum: { quantity: true },
    });

    const used = new Map(
      grouped.map((row) => [
        `${row.type}:${row.refId}:${toDateOnly(row.date)}`,
        row._sum.quantity ?? 0,
      ]),
    );

    const resolved = await this.refs.resolve(
      bookable.map((item) => ({ type: item.type, refId: item.refId })),
    );

    const shortfall: Array<{ type: ItemType; refId: string; title: string; date: string }> = [];

    for (const item of bookable) {
      const date = toDateOnly(addDays(start, item.dayNumber - 1));
      const capacity = this.refs.capacityFor(item.type, item.refId, resolved);
      if (capacity === null) {
        continue;
      }
      const requested = unitsFor(item.type, plan.guests);
      const alreadyUsed = used.get(`${item.type}:${item.refId}:${date}`) ?? 0;
      if (capacity - alreadyUsed < requested) {
        shortfall.push({ type: item.type, refId: item.refId!, title: item.title, date });
      }
    }

    return shortfall;
  }

  /** Per-year sequential reference, allocated inside the booking transaction. */
  private async nextReference(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getUTCFullYear();
    const countThisYear = await tx.booking.count({
      where: { reference: { startsWith: `DLG-${year}-` } },
    });
    return formatReference(year, countThisYear + 1);
  }

  /** Short, human-readable code shown at check-in. */
  private generateCheckInCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }
}
