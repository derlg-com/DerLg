import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { hashPassword } from '../utils';
import type { ResetPasswordDto } from '../dto';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.redis.get(`password_reset:${dto.token}`);

    if (!userId) {
      throw new BadRequestException({
        code: ErrorCode.AUTH_RESET_TOKEN_INVALID,
        message: 'Invalid or expired reset token',
      });
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(`password_reset:${dto.token}`);
  }
}
