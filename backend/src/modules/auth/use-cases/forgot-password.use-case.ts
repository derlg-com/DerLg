import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SendResetEmailUseCase } from './send-reset-email.use-case';
import { randomUUID } from 'crypto';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly sendResetEmail: SendResetEmailUseCase,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Silent return to prevent email enumeration
      return;
    }

    const token = randomUUID();
    await this.redis.setex(`password_reset:${token}`, 3600, user.id);

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await this.sendResetEmail.execute(email, resetLink);
  }
}
