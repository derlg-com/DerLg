import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';

import type { AdminRole } from '@prisma/client';

/**
 * Current-user payload. `adminRole` and `permissions` are null for non-admins,
 * which is what lets the admin panel decide its navigation from one request.
 */
export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  preferredLanguage: string;
  avatarUrl: string | null;
  loyaltyPoints: number;
  adminRole: AdminRole | null;
  permissions: Record<string, boolean> | null;
}

@Injectable()
export class GetMeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        preferredLanguage: true,
        avatarUrl: true,
        loyaltyPoints: true,
        adminProfile: {
          select: { adminRole: true, permissions: true, isActive: true },
        },
      },
    });

    // The token verified, but the user is gone — treat as an invalid session
    // rather than a 404, so the client clears its tokens and re-authenticates.
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'User no longer exists',
      });
    }

    // A deactivated grant is reported as "not an admin" so the UI hides admin
    // navigation instead of offering routes that would return 403.
    const admin =
      user.adminProfile && user.adminProfile.isActive
        ? user.adminProfile
        : null;

    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      avatarUrl: user.avatarUrl,
      loyaltyPoints: user.loyaltyPoints,
      adminRole: admin?.adminRole ?? null,
      permissions:
        (admin?.permissions as Record<string, boolean> | null) ?? null,
    };
  }
}
