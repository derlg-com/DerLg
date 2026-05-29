import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchTripsDto,
  SearchHotelsDto,
  SearchGuidesDto,
  SearchTransportDto,
  CheckAvailabilityDto,
  CreateBookingHoldDto,
  SendSosAlertDto,
  GeneratePaymentQrDto,
  EstimateBudgetDto,
  GetPlacesDto,
  GetFestivalsDto,
} from './ai-tools.dto';

const HOLD_TTL_MIN = 15;

@Injectable()
export class AiToolsService {
  constructor(private prisma: PrismaService) {}

  async searchTrips(dto: SearchTripsDto) {
    const trips = await this.prisma.trip.findMany({
      where: {
        isPublished: true,
        durationDays: dto.duration_days,
        basePriceUsd: { lte: dto.budget_usd },
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
      where: { isPublished: true },
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
        languages: { some: { language: dto.language as 'en' | 'zh' | 'km' } },
      },
      take: 10,
    });
    return guides.map((g) => ({
      id: g.id,
      bio: g.bio,
      price_per_day_usd: Number(g.pricePerDayUsd),
      province: g.province,
      avatar_url: g.avatarUrl,
    }));
  }

  async searchTransport(dto: SearchTransportDto) {
    const vehicles = await this.prisma.transportationVehicle.findMany({
      where: {
        isActive: true,
        province: { contains: dto.from_location, mode: 'insensitive' },
        ...(dto.mode ? { vehicleType: dto.mode as never } : {}),
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
      from_location: dto.from_location,
      to_location: dto.to_location,
      departure_date: dto.departure_date,
      pricing_model: v.pricingModel,
      images: v.images,
    }));
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
          date,
          booking: { status: { in: ['reserved', 'confirmed'] } },
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

    let unitPrice = 0;
    let bookingType:
      | 'trip_package'
      | 'hotel_room'
      | 'tour_guide'
      | 'transportation' = 'trip_package';

    if (dto.item_type === 'trip') {
      const trip = await this.prisma.trip.findUnique({
        where: { id: dto.item_id },
      });
      if (!trip) throw new NotFoundException('Trip not found');
      unitPrice = Number(trip.basePriceUsd);
      bookingType = 'trip_package';
    } else if (dto.item_type === 'hotel') {
      const room = await this.prisma.hotelRoom.findUnique({
        where: { id: dto.item_id },
      });
      if (!room) throw new NotFoundException('Hotel room not found');
      unitPrice = Number(room.priceUsd);
      bookingType = 'hotel_room';
    } else if (dto.item_type === 'transport') {
      const vehicle = await this.prisma.transportationVehicle.findUnique({
        where: { id: dto.item_id },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      unitPrice = Number(vehicle.priceUsd);
      bookingType = 'transportation';
    } else {
      const guide = await this.prisma.guide.findUnique({
        where: { id: dto.item_id },
      });
      if (!guide) throw new NotFoundException('Guide not found');
      unitPrice = Number(guide.pricePerDayUsd);
      bookingType = 'tour_guide';
    }

    const subtotal = unitPrice * dto.people_count;
    const travelDate = new Date(dto.travel_date);
    const singleResourceKind =
      dto.item_type === 'trip'
        ? 'trip'
        : dto.item_type === 'hotel'
          ? 'hotel'
          : 'guide';

    const booking = await this.prisma.booking.create({
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
            ...(dto.item_type === 'hotel' ? { hotelRoomId: dto.item_id } : {}),
            ...(dto.item_type === 'guide' ? { guideId: dto.item_id } : {}),
            startDate: travelDate,
            endDate: travelDate,
            ...(dto.item_type === 'transport'
              ? { vehicleId: dto.item_id }
              : {}),
            date: travelDate,
            quantity: dto.people_count,
            unitPriceUsd: unitPrice,
            subtotalUsd: subtotal,
            snapshot: {
              source: 'ai-tools',
              itemType: dto.item_type,
              itemId: dto.item_id,
            },
          },
        },
      },
    });

    return {
      booking_id: booking.id,
      reference: booking.reference,
      amount_usd: Number(booking.totalUsd),
      expires_at: booking.expiresAt!.toISOString(),
      hold_expires_at: booking.expiresAt!.toISOString(),
      methods: ['stripe', 'bakong'],
    };
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
