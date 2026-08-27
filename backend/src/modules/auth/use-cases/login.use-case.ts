import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { comparePassword } from '../utils';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import type { LoginDto } from '../dto';
import type { AuthResponse } from '../interfaces';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generateTokens: GenerateTokensUseCase,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { adminProfile: { select: { isActive: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await comparePassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        code: ErrorCode.AUTH_ACCOUNT_SUSPENDED,
        message: 'Your account has been suspended',
      });
    }

    // A revoked admin grant must block sign-in outright rather than yielding a
    // token that every admin route would then reject.
    if (user.adminProfile && !user.adminProfile.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.AUTH_ACCOUNT_SUSPENDED,
        message: 'Your admin account has been deactivated',
      });
    }

    return this.generateTokens.execute(user);
  }
}
