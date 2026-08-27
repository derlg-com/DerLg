import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BookingType,
  DiscountType,
  AuditEventType,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDiscountsService {
  private readonly logger = new Logger(AdminDiscountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllDiscountCodes(filters: { page?: string; limit?: string }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.discountCode.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.discountCode.count(),
    ]);

    const mapped = data.map((code) => ({
      id: code.id,
      code: code.code,
      discountType: code.discountType,
      value: Number(code.value),
      maxUses: code.maxUses,
      currentUses: code.currentUses,
      minBookingUsd: code.minBookingUsd ? Number(code.minBookingUsd) : null,
      validFrom: code.validFrom,
      validUntil: code.validUntil,
      isActive: code.isActive,
      festivalId: code.festivalId,
      bookingType: code.bookingType,
      userId: code.userId,
      createdAt: code.createdAt,
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

  async createDiscountCode(dto: {
    code: string;
    discountType: DiscountType;
    value: number;
    maxUses?: number;
    minBookingUsd?: number;
    validFrom: string;
    validUntil: string;
    bookingType?: BookingType;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.discountCode.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Discount code '${dto.code}' already exists`);
    }

    const codeId = randomUUID();

    return this.prisma.discountCode.create({
      data: {
        id: codeId,
        code: dto.code,
        discountType: dto.discountType,
        value: dto.value,
        maxUses: dto.maxUses || null,
        minBookingUsd: dto.minBookingUsd || null,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        bookingType: dto.bookingType,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateDiscountCode(
    id: string,
    dto: {
      code?: string;
      discountType?: DiscountType;
      value?: number;
      maxUses?: number;
      minBookingUsd?: number;
      validFrom?: string;
      validUntil?: string;
      bookingType?: BookingType;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.discountCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Discount code with id ${id} not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      const conflict = await this.prisma.discountCode.findUnique({
        where: { code: dto.code },
      });
      if (conflict) {
        throw new ConflictException(
          `Discount code '${dto.code}' already exists`,
        );
      }
    }

    return this.prisma.discountCode.update({
      where: { id },
      data: {
        code: dto.code,
        discountType: dto.discountType,
        value: dto.value,
        maxUses: dto.maxUses,
        minBookingUsd: dto.minBookingUsd,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        bookingType: dto.bookingType,
        isActive: dto.isActive,
      },
    });
  }

  async deactivateDiscountCode(id: string) {
    const existing = await this.prisma.discountCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Discount code with id ${id} not found`);
    }

    return this.prisma.discountCode.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async getAllStudentVerifications(filters: {
    status?: string;
    page?: string;
    limit?: string;
  }) {
    const { status, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    // Its own model: this method lists student verifications, not discount codes.
    const where: Prisma.StudentVerificationWhereInput = {};
    if (status) {
      if (!(Object.values(VerificationStatus) as string[]).includes(status)) {
        throw new BadRequestException(
          `Invalid status. Expected one of: ${Object.values(VerificationStatus).join(', ')}`,
        );
      }
      where.status = status as VerificationStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.studentVerification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isStudentVerified: true,
            },
          },
        },
      }),
      this.prisma.studentVerification.count({ where }),
    ]);

    const mapped = data.map((v) => ({
      id: v.id,
      userId: v.userId,
      user: v.user,
      idCardImageUrl: v.idCardImageUrl,
      selfieImageUrl: v.selfieImageUrl,
      status: v.status,
      reviewedById: v.reviewedById,
      reviewNotes: v.reviewNotes,
      reviewedAt: v.reviewedAt,
      expiresAt: v.expiresAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
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

  async reviewStudentVerification(
    id: string,
    dto: {
      status: VerificationStatus;
      reviewNotes?: string;
    },
    reviewedById?: string,
  ) {
    const existing = await this.prisma.studentVerification.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, isStudentVerified: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Student verification with id ${id} not found`,
      );
    }

    const verification = await this.prisma.studentVerification.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNotes: dto.reviewNotes || existing.reviewNotes,
        reviewedById: reviewedById || existing.reviewedById,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            isStudentVerified: true,
          },
        },
      },
    });

    if (dto.status === VerificationStatus.approved) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: { isStudentVerified: true },
      });
    } else if (dto.status === VerificationStatus.rejected) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: { isStudentVerified: false },
      });
    }

    return {
      id: verification.id,
      userId: verification.userId,
      user: verification.user,
      status: verification.status,
      reviewedById: verification.reviewedById,
      reviewNotes: verification.reviewNotes,
      reviewedAt: verification.reviewedAt,
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
