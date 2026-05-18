import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { randomUUID } from 'crypto';
import { hashPassword } from '../utils';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import type { RegisterDto } from '../dto';
import type { AuthResponse } from '../interfaces';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generateTokens: GenerateTokensUseCase,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCode.AUTH_EMAIL_EXISTS,
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.name ?? null,
        phone: dto.phone ?? null,
        supabaseUid: randomUUID(),
      },
    });

    return this.generateTokens.execute(user);
  }
}
