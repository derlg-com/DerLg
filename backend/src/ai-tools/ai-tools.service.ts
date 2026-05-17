import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchTripsDto,
  SearchHotelsDto,
  SearchGuidesDto,
  CheckAvailabilityDto,
  CreateBookingHoldDto,
  SendSosAlertDto,
} from './ai-tools.dto';

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

  async checkAvailability(dto: CheckAvailabilityDto) {
    const date = new Date(dto.date);

    if (dto.item_type === 'trip') {
      const trip = await this.prisma.trip.findUnique({ where: { id: dto.item_id } });
      if (!trip) throw new NotFoundException('Trip not found');
      const booked = await this.prisma.bookingItem.count({
        where: {
          tripId: dto.item_id,
          date,
          booking: { status: { in: ['reserved', 'confirmed'] } },
        },
      });
      return { available: booked < trip.maxCapacity, remaining: trip.maxCapacity - booked };
    }

    if (dto.item_type === 'guide') {
      const booked = await this.prisma.bookingItem.count({
        where: {
          guideId: dto.item_id,
          date,
          booking: { status: { in: ['reserved', 'confirmed'] } },
        },
      });
      return { available: booked === 0 };
    }

    // hotel — check any active room
    const rooms = await this.prisma.hotelRoom.findMany({
      where: { hotelId: dto.item_id, isActive: true },
      select: { id: true },
    });
    const bookedRoomIds = await this.prisma.bookingItem.findMany({
      where: {
        hotelRoomId: { in: rooms.map((r) => r.id) },
        date,
        booking: { status: { in: ['reserved', 'confirmed'] } },
      },
      select: { hotelRoomId: true },
    });
    const bookedSet = new Set(bookedRoomIds.map((b) => b.hotelRoomId));
    const available = rooms.filter((r) => !bookedSet.has(r.id)).length;
    return { available: available > 0, rooms_available: available };
  }

  async createBookingHold(dto: CreateBookingHoldDto) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const reference = `DLG-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;

    let unitPrice = 0;
    let bookingType: 'trip_package' | 'hotel_room' | 'tour_guide' = 'trip_package';

    if (dto.item_type === 'trip') {
      const trip = await this.prisma.trip.findUnique({ where: { id: dto.item_id } });
      if (!trip) throw new NotFoundException('Trip not found');
      unitPrice = Number(trip.basePriceUsd);
      bookingType = 'trip_package';
    } else if (dto.item_type === 'hotel') {
      const room = await this.prisma.hotelRoom.findUnique({ where: { id: dto.item_id } });
      if (!room) throw new NotFoundException('Hotel room not found');
      unitPrice = Number(room.priceUsd);
      bookingType = 'hotel_room';
    } else {
      const guide = await this.prisma.guide.findUnique({ where: { id: dto.item_id } });
      if (!guide) throw new NotFoundException('Guide not found');
      unitPrice = Number(guide.pricePerDayUsd);
      bookingType = 'tour_guide';
    }

    const subtotal = unitPrice * dto.people_count;
    const travelDate = new Date(dto.travel_date);

    const booking = await this.prisma.booking.create({
      data: {
        userId: dto.user_id,
        reference,
        startDate: travelDate,
        status: 'reserved',
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
            date: travelDate,
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
      methods: ['stripe', 'bakong'],
    };
  }

  getWeather(location: string, date: string) {
    // Stub — real implementation would call a weather API
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
    // location may be "lat,lng" or a place name — parse best-effort
    const parts = dto.location.split(',');
    const lat = parseFloat(parts[0]) || 11.5564; // default: Phnom Penh
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
    return { sent: true, message: 'SOS alert triggered. Emergency services notified.' };
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
