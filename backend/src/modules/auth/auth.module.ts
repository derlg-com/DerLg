import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import {
  GenerateTokensUseCase,
  RegisterUseCase,
  LoginUseCase,
  LogoutUseCase,
  LogoutAllDevicesUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  RefreshTokenUseCase,
  SendResetEmailUseCase,
  GoogleAuthUseCase,
  GoogleCallbackUseCase,
} from './use-cases';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    GenerateTokensUseCase,
    RegisterUseCase,
    LoginUseCase,
    LogoutUseCase,
    LogoutAllDevicesUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    RefreshTokenUseCase,
    SendResetEmailUseCase,
    GoogleAuthUseCase,
    GoogleCallbackUseCase,
  ],
})
export class AuthModule {}
