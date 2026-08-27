import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerResponseDto } from '../dto/customer-response.dto';
import { AuditEventType, Prisma } from '@prisma/client';

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllCustomers(filters: {
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          loyaltyPoints: true,
          isStudentVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bookings: true,
              reviews: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = data.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      loyaltyPoints: user.loyaltyPoints,
      isStudentVerified: user.isStudentVerified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bookingCount: user._count.bookings,
      reviewCount: user._count.reviews,
    }));

    return {
      data: mapped,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getCustomerById(id: string): Promise<
    CustomerResponseDto & {
      bookings: Array<{
        id: string;
        reference: string;
        status: string;
        totalUsd: number;
        startDate: Date | null;
        endDate: Date | null;
        createdAt: Date;
      }>;
      loyaltyTransactions: Array<{
        id: string;
        type: string;
        points: number;
        balanceAfter: number;
        reference: string | null;
        createdAt: Date;
      }>;
      reviews: Array<{
        id: string;
        rating: number;
        text: string | null;
        hotelId: string | null;
        guideId: string | null;
        tripId: string | null;
        createdAt: Date;
      }>;
    }
  > {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            totalUsd: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            points: true,
            balanceAfter: true,
            reference: true,
            createdAt: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            text: true,
            hotelId: true,
            guideId: true,
            tripId: true,
            createdAt: true,
          },
        },
        _count: {
          select: { bookings: true, reviews: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const totalSpent = user.bookings.reduce(
      (sum, b) => sum + Number(b.totalUsd || 0),
      0,
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      loyaltyPoints: user.loyaltyPoints,
      isStudentVerified: user.isStudentVerified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bookingCount: user._count.bookings,
      reviewCount: user._count.reviews,
      totalSpentUsd: totalSpent,
      bookings: user.bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        totalUsd: Number(b.totalUsd),
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt,
      })),
      loyaltyTransactions: user.loyaltyTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        balanceAfter: t.balanceAfter,
        reference: t.reference,
        createdAt: t.createdAt,
      })),
      reviews: user.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        hotelId: r.hotelId,
        guideId: r.guideId,
        tripId: r.tripId,
        createdAt: r.createdAt,
      })),
    };
  }

  async getCustomerReviews(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }

    const reviews = await this.prisma.review.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        text: true,
        images: true,
        isVerifiedBooking: true,
        hotelId: true,
        guideId: true,
        tripId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      text: review.text,
      images: review.images,
      isVerifiedBooking: review.isVerifiedBooking,
      hotelId: review.hotelId,
      guideId: review.guideId,
      tripId: review.tripId,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));
  }

  async adjustLoyaltyPoints(dto: {
    userId: string;
    points: number;
    description: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, loyaltyPoints: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} not found`);
    }

    const newBalance = Math.max(0, user.loyaltyPoints + dto.points);

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: dto.userId },
        data: {
          loyaltyPoints: newBalance,
        },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          id: randomUUID(),
          userId: dto.userId,
          type: 'adjusted',
          points: dto.points,
          balanceAfter: newBalance,
          reference: dto.description,
          createdAt: new Date(),
        },
      }),
    ]);

    return {
      userId: dto.userId,
      previousBalance: user.loyaltyPoints,
      adjustment: dto.points,
      newBalance: updatedUser.loyaltyPoints,
      description: dto.description,
    };
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
