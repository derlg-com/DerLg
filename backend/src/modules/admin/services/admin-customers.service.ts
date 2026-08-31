import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CustomerResponseDto } from '../dto/customer-response.dto';
import {
  ASSIGNABLE_CUSTOMER_ROLES,
  UpdateCustomerDto,
} from '../dto/update-customer.dto';
import { AuditEventType, Prisma, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllCustomers(filters: {
    search?: string;
    status?: UserStatus;
    page?: string;
    limit?: string;
  }) {
    const { search, status, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.UserWhereInput = {};
    if (status) {
      where.status = status;
    }
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
          status: true,
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
      status: user.status,
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

  /**
   * Suspends or restores a customer account.
   *
   * `User.status` and the `suspended` rejection in the login use case already
   * existed, but nothing could set the column — so an abusive or compromised
   * account could not actually be locked out. Suspension therefore does three
   * things, not one:
   *
   *  1. flips the status, which blocks future sign-ins,
   *  2. revokes every refresh token, so the session cannot be renewed,
   *  3. deletes the Redis session keys the refresh flow validates against.
   *
   * Without (2) and (3) a suspended user keeps working access for as long as they
   * keep refreshing. The 15-minute access token is the only remaining window.
   */
  async setCustomerStatus(
    id: string,
    status: UserStatus,
    reason: string,
  ): Promise<{
    id: string;
    previousStatus: UserStatus;
    status: UserStatus;
    reason: string;
    revokedTokenCount: number;
    clearedSessionKeys: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    let revokedTokenCount = 0;
    let clearedSessionKeys = 0;

    // Only tear down sessions when access is being taken away. Reactivating
    // should not punish a user by logging them out of other devices.
    if (status !== UserStatus.active) {
      // Clearing Redis is what actually blocks renewal. `refresh-token.use-case`
      // validates the presented token against `session:{userId}:{tokenId}`, so
      // deleting those keys makes every outstanding refresh token unusable.
      try {
        clearedSessionKeys = await this.redis.delByPattern(`session:${id}:*`);
      } catch (error) {
        this.logger.error(
          `Failed to clear Redis sessions for suspended user ${id} — ` +
            `outstanding refresh tokens may still work until they expire: ${(error as Error).message}`,
        );
      }

      // The `refresh_tokens` table is a secondary record: the current auth flow
      // stores tokens only in Redis and never inserts here, so this normally
      // updates nothing. Kept so that any rows written by an older build, or by a
      // future DB-backed flow, are also revoked rather than silently honoured.
      const revoked = await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      revokedTokenCount = revoked.count;
    }

    return {
      id: updated.id,
      previousStatus: user.status,
      status: updated.status,
      reason,
      revokedTokenCount,
      clearedSessionKeys,
    };
  }

  /** Edits profile fields. Email is not editable — it is the login identity. */
  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        preferredLanguage: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Changes a non-admin role.
   *
   * Two guards, both deliberate:
   *
   * Admin roles are refused outright. A `users.role` of `operations_manager`
   * without a matching `admin_users` grant produces a JWT claiming privilege that
   * `AdminRoleGuard` then denies — a confusing half-privileged account. Creating
   * admins is `/admin/users`' job, which writes both rows together.
   *
   * Self-changes are refused so a super admin cannot demote themselves out of the
   * only account that can undo it.
   */
  async setCustomerRole(
    id: string,
    role: UserRole,
    actingUserId?: string,
  ): Promise<{ id: string; previousRole: UserRole; role: UserRole }> {
    if (actingUserId && actingUserId === id) {
      throw new BadRequestException(
        'You cannot change your own role. Ask another super admin to do it.',
      );
    }

    if (!ASSIGNABLE_CUSTOMER_ROLES.includes(role as never)) {
      throw new ForbiddenException(
        `Role '${role}' cannot be granted here. Assignable roles are: ` +
          `${ASSIGNABLE_CUSTOMER_ROLES.join(', ')}. Use /admin/users to grant admin roles.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, adminProfile: { select: { id: true } } },
    });
    if (!user) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    // Demoting someone who still holds an admin grant would leave the grant
    // orphaned and the account in an inconsistent state.
    if (user.adminProfile) {
      throw new ForbiddenException(
        'This account has an admin grant. Deactivate it via /admin/users before changing the role.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, role: true },
    });

    return { id: updated.id, previousRole: user.role, role: updated.role };
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
