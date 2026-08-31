import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SingleResourceKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchTripsDto,
  SearchHotelsDto,
  SearchGuidesDto,
  SearchTransportDto,
  CheckAvailabilityDto,
  CreateBookingHoldDto,
  CreateCustomTripDto,
  SendSosAlertDto,
  GeneratePaymentQrDto,
  EstimateBudgetDto,
  GetPlacesDto,
  GetFestivalsDto,
  UpsertChatSessionDto,
  RebindChatSessionDto,
  AppendChatMessagesDto,
  ChatMessageFeedbackDto,
} from './ai-tools.dto';
import { ErrorCode } from '../../common/errors/error-codes';

const HOLD_TTL_MIN = 15;

@Injectable()
export class AiToolsService {
  constructor(private prisma: PrismaService) {}

  async searchTrips(dto: SearchTripsDto) {
    // Destination is matched against free text (title/subtitle/description) because
    // Trip has no structured province column; reliable filtering needs a schema
    // migration + reseed (searchHotels has the same limitation on `address`).
    const trips = await this.prisma.trip.findMany({
      where: {
        isPublished: true,
        // Duration is a ±2-day tolerance window (not exact) so a 5-day trip
        // still surfaces for a "3 day" request instead of returning empty.
        ...(dto.duration_days
          ? {
              durationDays: {
                gte: dto.duration_days - 2,
                lte: dto.duration_days + 2,
              },
            }
          : {}),
        ...(dto.budget_usd ? { basePriceUsd: { lte: dto.budget_usd } } : {}),
        ...(dto.destination
          ? {
              translations: {
                some: {
                  OR: [
                    {
                      title: { contains: dto.destination, mode: 'insensitive' },
                    },
                    {
                      subtitle: {
                        contains: dto.destination,
                        mode: 'insensitive',
                      },
                    },
                    {
                      description: {
                        contains: dto.destination,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            }
          : {}),
      },
      include: { translations: { where: { language: 'en' } } },
      take: 10,
    });
    return trips.map((t) => ({
      id: t.id,
      title: t.translations[0]?.title ?? '',
      duration_days: t.durationDays,
      price_usd: Number(t.basePriceUsd),
      category: t.category,
      cover_image: t.coverImage,
    }));
  }

  async searchHotels(dto: SearchHotelsDto) {
    const hotels = await this.prisma.hotel.findMany({
      where: {
        isPublished: true,
        ...(dto.city
          ? {
              translations: {
                some: { address: { contains: dto.city, mode: 'insensitive' } },
              },
            }
          : {}),
        ...(dto.type ? { type: dto.type } : {}),
        rooms: {
          some: {
            isActive: true,
            ...(dto.price_range ? { priceUsd: { lte: dto.price_range } } : {}),
          },
        },
      },
      include: {
        translations: { where: { language: 'en' } },
        rooms: {
          where: {
            isActive: true,
            ...(dto.price_range ? { priceUsd: { lte: dto.price_range } } : {}),
          },
          take: 1,
          orderBy: { priceUsd: 'asc' },
        },
      },
      take: 10,
    });
    return hotels.map((h) => ({
      id: h.id,
      name: h.translations[0]?.name ?? '',
      address: h.translations[0]?.address ?? '',
      type: h.type,
      star_rating: h.starRating,
      price_from_usd: h.rooms[0] ? Number(h.rooms[0].priceUsd) : null,
      images: h.images,
    }));
  }

  async searchGuides(dto: SearchGuidesDto) {
    const guides = await this.prisma.guide.findMany({
      where: {
        isActive: true,
        isVerified: true,
        province: { contains: dto.location, mode: 'insensitive' },
        languages: { some: { language: dto.language as never } },
      },
      select: {
        id: true,
        userId: true,
        bio: true,
        avatarUrl: true,
        pricePerDayUsd: true,
        province: true,
        isVerified: true,
        languages: { select: { language: true } },
        specialties: { select: { specialty: true } },
        trips: {
          select: {
            id: true,
            durationDays: true,
            basePriceUsd: true,
            coverImage: true,
            translations: {
              where: { language: 'en' },
              select: { title: true },
            },
          },
          take: 5,
        },
      },
      take: 10,
    });

    // Guide has no name column and no Prisma relation to User; resolve display
    // names from the linked users in a single keyed query (avoids N+1).
    const userIds = guides.map((g) => g.userId);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameByUserId = new Map(users.map((u) => [u.id, u.fullName]));

    return guides.map((g) => ({
      id: g.id,
      name: nameByUserId.get(g.userId) || 'Local Guide',
      bio: g.bio,
      languages: g.languages.map((l) => l.language),
      specialties: g.specialties.map((s) => s.specialty),
      price_per_day_usd: Number(g.pricePerDayUsd),
      province: g.province,
      avatar_url: g.avatarUrl,
      is_verified: g.isVerified,
      packages: g.trips.map((t) => ({
        id: t.id,
        title: t.translations[0]?.title ?? '',
        duration_days: t.durationDays,
        price_usd: Number(t.basePriceUsd),
        cover_image: t.coverImage,
      })),
    }));
  }

  async searchTransport(dto: SearchTransportDto) {
    const vehicles = await this.prisma.transportationVehicle.findMany({
      where: {
        isActive: true,
        province: { contains: dto.from_location, mode: 'insensitive' },
        ...(dto.mode ? { vehicleType: dto.mode as never } : {}),
        ...(dto.tier ? { tier: dto.tier } : {}),
        ...(dto.subtype ? { subtype: dto.subtype } : {}),
      },
      take: 10,
      orderBy: { priceUsd: 'asc' },
    });
    return vehicles.map((v) => ({
      id: v.id,
      mode: v.vehicleType,
      operator: v.name,
      price_usd: Number(v.priceUsd),
      capacity: v.capacity,
      tier: v.tier,
      subtype: v.subtype,
      from_location: dto.from_location,
      to_location: dto.to_location,
      departure_date: dto.departure_date,
      pricing_model: v.pricingModel,
      images: v.images,
    }));
  }

  /**
   * P6b — AI-composed custom trip. Prices components server-side (hotel room
   * and guide/vehicle per-day rates x duration), caps extras at $500/unit via
   * the DTO, persists a real Trip row (category=custom, extras JSON) and
   * returns the composed quote in snake_case for the agent's normalizer.
   */
  async createCustomTrip(dto: CreateCustomTripDto) {
    const durationDays = dto.duration_days;
    const hasComponents =
      Boolean(dto.hotel_room_id) ||
      Boolean(dto.guide_id) ||
      Boolean(dto.vehicle_id);
    const extras = dto.extras ?? [];
    if (!hasComponents && extras.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.AI_TRIP_EMPTY,
        message: 'Custom trip must include at least one component or extra',
      });
    }

    const [room, guide, vehicle] = await Promise.all([
      dto.hotel_room_id
        ? this.prisma.hotelRoom.findUnique({
            where: { id: dto.hotel_room_id },
            include: {
              hotel: {
                include: {
                  translations: {
                    where: { language: 'en' },
                    select: { name: true },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
      dto.guide_id
        ? this.prisma.guide.findUnique({ where: { id: dto.guide_id } })
        : Promise.resolve(null),
      dto.vehicle_id
        ? this.prisma.transportationVehicle.findUnique({
            where: { id: dto.vehicle_id },
          })
        : Promise.resolve(null),
    ]);

    if (dto.hotel_room_id && !room) {
      throw new NotFoundException({
        code: ErrorCode.AI_TRIP_COMPONENT_NOT_FOUND,
        message: 'Hotel room not found',
      });
    }
    if (dto.guide_id && !guide) {
      throw new NotFoundException({
        code: ErrorCode.AI_TRIP_COMPONENT_NOT_FOUND,
        message: 'Guide not found',
      });
    }
    if (dto.vehicle_id && !vehicle) {
      throw new NotFoundException({
        code: ErrorCode.AI_TRIP_COMPONENT_NOT_FOUND,
        message: 'Vehicle not found',
      });
    }

    // Guide has no name column; resolve display name from the linked user.
    let guideName: string | null = null;
    if (guide) {
      const guideUser = await this.prisma.user.findUnique({
        where: { id: guide.userId },
        select: { fullName: true },
      });
      guideName = guideUser?.fullName ?? null;
    }

    // Per-day components are priced as unit x duration (nights ≈ duration days).
    const items: {
      type: 'hotel' | 'guide' | 'transport';
      name: string;
      unit_price_usd: number;
      quantity: number;
      subtotal_usd: number;
    }[] = [];

    if (room) {
      const unit = Number(room.priceUsd);
      items.push({
        type: 'hotel',
        name: room.hotel.translations[0]?.name ?? room.roomType,
        unit_price_usd: unit,
        quantity: durationDays,
        subtotal_usd: round2(unit * durationDays),
      });
    }
    if (guide) {
      const unit = Number(guide.pricePerDayUsd);
      items.push({
        type: 'guide',
        name: guideName ?? 'Tour Guide',
        unit_price_usd: unit,
        quantity: durationDays,
        subtotal_usd: round2(unit * durationDays),
      });
    }
    if (vehicle) {
      const unit = Number(vehicle.priceUsd);
      items.push({
        type: 'transport',
        name: vehicle.name,
        unit_price_usd: unit,
        quantity: durationDays,
        subtotal_usd: round2(unit * durationDays),
      });
    }

    const extrasOut = extras.map((e) => ({
      name: e.name,
      description: e.description ?? null,
      unit_price_usd: e.unit_price_usd,
      quantity: e.quantity,
      subtotal_usd: round2(e.unit_price_usd * e.quantity),
    }));

    const totalUsd = round2(
      items.reduce((s, i) => s + i.subtotal_usd, 0) +
        extrasOut.reduce((s, e) => s + e.subtotal_usd, 0),
    );

    const trip = await this.prisma.trip.create({
      data: {
        category: 'custom',
        durationDays,
        basePriceUsd: totalUsd,
        maxCapacity: 10,
        isPublished: true, // published so /v1/trips/:id renders the bookable card
        extras: extrasOut,
        ...(guide ? { guides: { connect: { id: guide.id } } } : {}),
        translations: {
          create: {
            language: 'en',
            title: dto.title,
            description: dto.description ?? undefined,
          },
        },
      },
    });

    return {
      id: trip.id,
      title: dto.title,
      description: dto.description ?? null,
      duration_days: durationDays,
      total_usd: totalUsd,
      items,
      extras: extrasOut,
      ...(dto.start_date ? { start_date: dto.start_date } : {}),
    };
  }

  async checkAvailability(dto: CheckAvailabilityDto) {
    const date = new Date(dto.date);

    if (dto.item_type === 'trip') {
      const trip = await this.prisma.trip.findUnique({
        where: { id: dto.item_id },
      });
      if (!trip) throw new NotFoundException('Trip not found');
      const booked = await this.prisma.bookingItem.count({
        where: {
          tripId: dto.item_id,
          startDate: { lte: date },
          endDate: { gte: date },
          booking: {
            status: { in: ['hold', 'pending_payment', 'confirmed'] },
            deletedAt: null,
          },
        },
      });
      return {
        available: booked < trip.maxCapacity,
        remaining: trip.maxCapacity - booked,
      };
    }

    if (dto.item_type === 'guide') {
      const booked = await this.prisma.bookingItem.count({
        where: {
          guideId: dto.item_id,
          startDate: { lte: date },
          endDate: { gte: date },
          booking: {
            status: { in: ['hold', 'pending_payment', 'confirmed'] },
            deletedAt: null,
          },
        },
      });
      return { available: booked === 0 };
    }

    if (dto.item_type === 'transport') {
      const vehicle = await this.prisma.transportationVehicle.findUnique({
        where: { id: dto.item_id },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      const booked = await this.prisma.bookingItem.count({
        where: {
          vehicleId: dto.item_id,
          startDate: { lte: date },
          endDate: { gte: date },
          booking: { status: { in: ['hold', 'pending_payment', 'confirmed'] } },
        },
      });
      return {
        available: booked < vehicle.capacity,
        remaining: vehicle.capacity - booked,
      };
    }

    // hotel — check any active room
    const rooms = await this.prisma.hotelRoom.findMany({
      where: { hotelId: dto.item_id, isActive: true },
      select: { id: true },
    });
    const bookedRoomIds = await this.prisma.bookingItem.findMany({
      where: {
        hotelRoomId: { in: rooms.map((r) => r.id) },
        startDate: { lte: date },
        endDate: { gte: date },
        booking: {
          status: { in: ['hold', 'pending_payment', 'confirmed'] },
          deletedAt: null,
        },
      },
      select: { hotelRoomId: true },
    });
    const bookedSet = new Set(bookedRoomIds.map((b) => b.hotelRoomId));
    const available = rooms.filter((r) => !bookedSet.has(r.id)).length;
    return { available: available > 0, rooms_available: available };
  }

  async createBookingHold(dto: CreateBookingHoldDto) {
    const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60 * 1000);
    const reference = `DLG-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
    const travelDate = new Date(dto.travel_date);
    const singleResourceKind: SingleResourceKind =
      dto.item_type === 'trip'
        ? 'trip'
        : dto.item_type === 'hotel'
          ? 'hotel'
          : dto.item_type === 'transport'
            ? 'transportation'
            : 'guide';

    return this.prisma.$transaction(async (tx) => {
      let unitPrice = 0;
      let bookingType:
        | 'trip_package'
        | 'hotel_room'
        | 'tour_guide'
        | 'transportation' = 'trip_package';

      if (dto.item_type === 'trip') {
        const trip = await tx.trip.findUnique({ where: { id: dto.item_id } });
        if (!trip) throw new NotFoundException('Trip not found');
        // Atomic availability check
        const booked = await tx.bookingItem.count({
          where: {
            tripId: dto.item_id,
            startDate: { lte: travelDate },
            endDate: { gte: travelDate },
            booking: {
              status: { in: ['hold', 'pending_payment', 'confirmed'] },
            },
          },
        });
        if (booked >= trip.maxCapacity)
          throw new Error('Trip is fully booked for this date');
        unitPrice = Number(trip.basePriceUsd);
        bookingType = 'trip_package';
      } else if (dto.item_type === 'hotel') {
        const room = await tx.hotelRoom.findUnique({
          where: { id: dto.item_id },
        });
        if (!room) throw new NotFoundException('Hotel room not found');
        const booked = await tx.bookingItem.count({
          where: {
            hotelRoomId: dto.item_id,
            startDate: { lte: travelDate },
            endDate: { gte: travelDate },
            booking: {
              status: { in: ['hold', 'pending_payment', 'confirmed'] },
            },
          },
        });
        if (booked > 0)
          throw new Error('Hotel room is not available for this date');
        unitPrice = Number(room.priceUsd);
        bookingType = 'hotel_room';
      } else if (dto.item_type === 'transport') {
        const vehicle = await tx.transportationVehicle.findUnique({
          where: { id: dto.item_id },
        });
        if (!vehicle) throw new NotFoundException('Vehicle not found');
        const booked = await tx.bookingItem.count({
          where: {
            vehicleId: dto.item_id,
            startDate: { lte: travelDate },
            endDate: { gte: travelDate },
            booking: {
              status: { in: ['hold', 'pending_payment', 'confirmed'] },
            },
          },
        });
        if (booked >= vehicle.capacity)
          throw new Error('Vehicle is fully booked for this date');
        unitPrice = Number(vehicle.priceUsd);
        bookingType = 'transportation';
      } else {
        const guide = await tx.guide.findUnique({ where: { id: dto.item_id } });
        if (!guide) throw new NotFoundException('Guide not found');
        const booked = await tx.bookingItem.count({
          where: {
            guideId: dto.item_id,
            startDate: { lte: travelDate },
            endDate: { gte: travelDate },
            booking: {
              status: { in: ['hold', 'pending_payment', 'confirmed'] },
            },
          },
        });
        if (booked > 0) throw new Error('Guide is not available for this date');
        unitPrice = Number(guide.pricePerDayUsd);
        bookingType = 'tour_guide';
      }

      const subtotal = unitPrice * dto.people_count;

      const booking = await tx.booking.create({
        data: {
          userId: dto.user_id,
          reference,
          method: 'single_resource',
          singleResourceKind,
          startDate: travelDate,
          status: 'hold',
          expiresAt,
          subtotalUsd: subtotal,
          totalUsd: subtotal,
          passengerCount: dto.people_count,
          items: {
            create: {
              bookingType,
              ...(dto.item_type === 'trip' ? { tripId: dto.item_id } : {}),
              ...(dto.item_type === 'hotel'
                ? { hotelRoomId: dto.item_id }
                : {}),
              ...(dto.item_type === 'guide' ? { guideId: dto.item_id } : {}),
              ...(dto.item_type === 'transport'
                ? { vehicleId: dto.item_id }
                : {}),
              startDate: travelDate,
              endDate: travelDate,
              snapshot: {},
              quantity: dto.people_count,
              unitPriceUsd: unitPrice,
              subtotalUsd: subtotal,
            },
          },
        },
      });

      return {
        booking_id: booking.id,
        reference: booking.reference,
        amount_usd: Number(booking.totalUsd),
        expires_at: booking.expiresAt.toISOString(),
        hold_expires_at: booking.expiresAt.toISOString(),
        methods: ['stripe', 'bakong'],
      };
    });
  }

  async generatePaymentQr(dto: GeneratePaymentQrDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.booking_id },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const expiry = new Date(Date.now() + HOLD_TTL_MIN * 60 * 1000);
    const provider = dto.provider.toLowerCase().includes('aba')
      ? 'aba'
      : 'bakong';
    const amount = Number(booking.totalUsd);

    // QR data string — for production, replace with actual KHQR generation
    // (e.g. KHQR.io SDK or Bakong QR specification).
    const qrData = `KHQR|${provider.toUpperCase()}|${booking.reference}|USD${amount.toFixed(2)}|EXP${expiry.getTime()}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        provider: 'bakong', // schema only has stripe|bakong; ABA QR shares Bakong KHQR
        amountUsd: amount,
        currency: 'usd',
        status: 'pending',
        qrCodeUrl: qrImageUrl,
        qrExpiresAt: expiry,
      },
    });

    return {
      payment_intent_id: payment.id,
      booking_id: booking.id,
      qr_data: qrData,
      qr_image_url: qrImageUrl,
      qr_url: qrImageUrl,
      amount_usd: amount,
      expiry: expiry.toISOString(),
      provider,
    };
  }

  async checkPaymentStatus(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const latestPayment = booking.payments[0];
    return {
      booking_id: bookingId,
      booking_status: booking.status,
      payment_intent_id: latestPayment?.id ?? null,
      status: latestPayment?.status ?? 'pending',
      amount_usd: latestPayment ? Number(latestPayment.amountUsd) : null,
      method: latestPayment?.provider ?? null,
      paid_at: latestPayment?.paidAt?.toISOString() ?? null,
    };
  }

  estimateBudget(dto: EstimateBudgetDto) {
    // Heuristic budget estimator. Real impl could call gpt-oss for parsing.
    const days = dto.duration_days ?? 3;
    const people = dto.people_count ?? 2;
    const tier = /luxur|premium|expensive/i.test(dto.query)
      ? 'luxury'
      : /budget|cheap|low|backpack/i.test(dto.query)
        ? 'budget'
        : 'mid';

    const perDay = tier === 'luxury' ? 250 : tier === 'budget' ? 45 : 110;
    const accomBase = tier === 'luxury' ? 180 : tier === 'budget' ? 25 : 70;
    const foodBase = tier === 'luxury' ? 60 : tier === 'budget' ? 12 : 30;
    const transportBase = tier === 'luxury' ? 80 : tier === 'budget' ? 8 : 25;
    const activityBase = tier === 'luxury' ? 120 : tier === 'budget' ? 15 : 50;

    const breakdown = [
      {
        category: 'Accommodation',
        min_usd: accomBase * days,
        max_usd: accomBase * days * 1.4,
        notes: `${tier}-tier hotels, ${days} night${days === 1 ? '' : 's'}`,
      },
      {
        category: 'Food & Drink',
        min_usd: foodBase * days * people,
        max_usd: foodBase * days * people * 1.5,
        notes: `${people} people, ${days} day${days === 1 ? '' : 's'}`,
      },
      {
        category: 'Local Transport',
        min_usd: transportBase * days,
        max_usd: transportBase * days * 1.4,
        notes: 'Tuk-tuks, taxis, intercity transfers',
      },
      {
        category: 'Activities & Tours',
        min_usd: activityBase * days,
        max_usd: activityBase * days * 1.6,
        notes: 'Temple passes, guided tours, attractions',
      },
    ];

    const totalMin = breakdown.reduce((s, b) => s + b.min_usd, 0);
    const totalMax = breakdown.reduce((s, b) => s + b.max_usd, 0);

    return {
      total_min_usd: Math.round(totalMin),
      total_max_usd: Math.round(totalMax),
      total_usd: Math.round((totalMin + totalMax) / 2),
      currency: dto.currency ?? 'USD',
      tier,
      duration_days: days,
      people_count: people,
      per_person_per_day_usd: perDay,
      breakdown: breakdown.map((b) => ({
        ...b,
        min_usd: Math.round(b.min_usd),
        max_usd: Math.round(b.max_usd),
      })),
    };
  }

  async getPlaces(dto: GetPlacesDto) {
    const places = await this.prisma.place.findMany({
      where: {
        isPublished: true,
        ...(dto.category ? { category: dto.category as never } : {}),
      },
      include: { translations: { where: { language: 'en' } } },
      take: dto.limit ?? 10,
    });
    return places.map((p) => ({
      id: p.id,
      name: p.translations[0]?.name ?? '',
      description: p.translations[0]?.description ?? '',
      address: p.translations[0]?.address ?? '',
      category: p.category,
      latitude: p.latitude ? Number(p.latitude) : null,
      longitude: p.longitude ? Number(p.longitude) : null,
      images: p.images,
      entry_fee_usd: p.entryFeeUsd ? Number(p.entryFeeUsd) : null,
    }));
  }

  async getFestivals(dto: GetFestivalsDto) {
    const where: Record<string, unknown> = {};
    if (dto.province) {
      where.province = { contains: dto.province, mode: 'insensitive' };
    }
    const festivals = await this.prisma.festival.findMany({
      where,
      include: { translations: { where: { language: 'en' } } },
      take: 20,
      orderBy: { startDate: 'asc' },
    });
    let result = festivals.map((f) => ({
      id: f.id,
      name: f.translations[0]?.name ?? '',
      description: f.translations[0]?.description ?? '',
      province: f.province ?? null,
      start_date: f.startDate?.toISOString() ?? null,
      end_date: f.endDate?.toISOString() ?? null,
      images: f.images,
    }));
    if (dto.month) {
      const monthIdx = monthNameToIndex(dto.month);
      if (monthIdx !== null) {
        result = result.filter((f) =>
          f.start_date ? new Date(f.start_date).getMonth() === monthIdx : false,
        );
      }
    }
    return result;
  }

  getWeather(location: string, date: string) {
    return {
      location,
      date,
      condition: 'sunny',
      temp_high_c: 32,
      temp_low_c: 24,
      humidity_pct: 70,
      note: 'Weather data is illustrative; integrate a live weather API for production.',
    };
  }

  getEmergencyContacts(location: string) {
    return {
      location,
      contacts: [
        { name: 'Police', number: '117' },
        { name: 'Ambulance', number: '119' },
        { name: 'Fire', number: '118' },
        { name: 'Tourist Police', number: '012 942 484' },
      ],
    };
  }

  async sendSosAlert(dto: SendSosAlertDto) {
    const parts = dto.location.split(',');
    const lat = parseFloat(parts[0]) || 11.5564;
    const lng = parseFloat(parts[1]) || 104.9282;

    // Verify the user exists before the write so a non-existent user_id (e.g. a
    // guest session) yields a clean 400 instead of surfacing the
    // emergencyAlert.userId foreign-key violation as an opaque HTTP 500.
    const user = await this.prisma.user.findUnique({
      where: { id: dto.user_id },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(`User ${dto.user_id} not found`);
    }

    await this.prisma.emergencyAlert.create({
      data: {
        userId: dto.user_id,
        alertType: 'sos',
        latitude: lat,
        longitude: lng,
        notes: `${dto.location} — ${dto.message}`,
        status: 'triggered',
      },
    });
    return {
      sent: true,
      message: 'SOS alert triggered. Emergency services notified.',
    };
  }

  async getUserLoyalty(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { user_id: userId, points: user.loyaltyPoints };
  }

  // -------------------------------------------------------------------------
  // Chat archive
  // -------------------------------------------------------------------------
  // The agent's live conversation lives in Redis with a 7-day TTL and a 60-turn
  // cap, so without these writes no transcript survives and every admin AI
  // metric reads zero. The agent calls them fire-and-forget behind its circuit
  // breaker: persistence must never block or break the chat stream.

  /**
   * Creates the session row, or refreshes it if the socket reconnected.
   *
   * Idempotent by `session_id`, which the agent generates and reuses across
   * reconnects, so a repeated connect does not fork the transcript.
   */
  async upsertChatSession(dto: UpsertChatSessionDto) {
    const session = await this.prisma.aIChatSession.upsert({
      where: { id: dto.session_id },
      create: {
        id: dto.session_id,
        userId: dto.user_id ?? null,
        guestKey: dto.guest_key ?? null,
        language: dto.language ?? 'en',
        title: dto.title ?? null,
      },
      update: {
        // A reconnect may carry a language switch, or a user id where the
        // previous connection was anonymous. Never overwrite a known user id
        // with null: `?? undefined` leaves the column untouched when absent.
        userId: dto.user_id ?? undefined,
        guestKey: dto.guest_key ?? undefined,
        language: dto.language ?? undefined,
        title: dto.title ?? undefined,
        isActive: true,
      },
      select: { id: true, userId: true, guestKey: true, language: true },
    });

    return {
      id: session.id,
      user_id: session.userId,
      guest_key: session.guestKey,
      language: session.language,
    };
  }

  /**
   * Rebinds an anonymous session to a real user.
   *
   * Called when a guest authenticates mid-conversation, so the turns already
   * archived under the guest handle stay attached to the same transcript and
   * become attributable in the AI-assisted booking correlation.
   */
  async rebindChatSession(sessionId: string, dto: RebindChatSessionDto) {
    await this.assertSessionExists(sessionId);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.user_id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.user_id} not found`);
    }

    const session = await this.prisma.aIChatSession.update({
      where: { id: sessionId },
      data: { userId: dto.user_id },
      select: { id: true, userId: true },
    });

    return { id: session.id, user_id: session.userId };
  }

  /**
   * Appends a batch of turns.
   *
   * `skipDuplicates` plus the [sessionId, seq] unique index is what makes the
   * flush safe to retry: the agent only advances its `flushed_seq` on a
   * successful response, so a timeout re-sends turns that may already have
   * landed. Those collide on seq and are dropped instead of duplicating.
   */
  async appendChatMessages(sessionId: string, dto: AppendChatMessagesDto) {
    await this.assertSessionExists(sessionId);

    if (dto.messages.length === 0) {
      return { inserted: 0, received: 0 };
    }

    const rows = dto.messages.map((m) => ({
      sessionId,
      seq: m.seq,
      role: m.role,
      content: m.content,
      messageType: m.message_type ?? 'text',
      metadata: (m.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    }));

    const latest = dto.messages.reduce(
      (max, m) => (m.seq > max.seq ? m : max),
      dto.messages[0],
    );

    // One transaction so `last_message_at` can never advance for a batch that
    // failed to insert — the admin session list orders on that column.
    const [created] = await this.prisma.$transaction([
      this.prisma.aIChatMessage.createMany({
        data: rows,
        skipDuplicates: true,
      }),
      this.prisma.aIChatSession.update({
        where: { id: sessionId },
        data: { lastMessageAt: new Date() },
        select: { id: true },
      }),
    ]);

    return {
      inserted: created.count,
      received: dto.messages.length,
      last_seq: latest.seq,
    };
  }

  /**
   * Records a thumbs up/down against one archived turn.
   *
   * Addressed by (session, seq) rather than the row's own uuid because the agent
   * knows the ordinal it assigned; it never sees the database id.
   */
  async setChatMessageFeedback(
    sessionId: string,
    seq: number,
    dto: ChatMessageFeedbackDto,
  ) {
    const message = await this.prisma.aIChatMessage.findUnique({
      where: { sessionId_seq: { sessionId, seq } },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException(
        `Message seq ${seq} not found for session ${sessionId}`,
      );
    }

    const updated = await this.prisma.aIChatMessage.update({
      where: { id: message.id },
      data: { helpful: dto.helpful },
      select: { id: true, seq: true, helpful: true },
    });

    return {
      id: updated.id,
      seq: updated.seq,
      helpful: updated.helpful,
    };
  }

  private async assertSessionExists(sessionId: string): Promise<void> {
    const session = await this.prisma.aIChatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthNameToIndex(month: string): number | null {
  const lookup: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const key = month.trim().toLowerCase();
  return lookup[key] ?? null;
}
