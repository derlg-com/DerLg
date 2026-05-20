import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiToolsModule } from './modules/ai-tools/ai-tools.module';
import { TripsModule } from './modules/trips/trips.module';
import { PlacesModule } from './modules/places/places.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { GuidesModule } from './modules/guides/guides.module';
import { TransportationModule } from './modules/transportation/transportation.module';
import { SearchModule } from './modules/search/search.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

/** Root module. Imports all shared infrastructure and configures global services. */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    AuthModule,
    UsersModule,
    AiToolsModule,
    TripsModule,
    PlacesModule,
    HotelsModule,
    GuidesModule,
    TransportationModule,
    SearchModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => [
        { name: 'default', ttl: 60000, limit: 10 },
        { name: 'auth', ttl: 300000, limit: 5 },
        { name: 'payment', ttl: 60000, limit: 3 },
      ],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level:
            configService.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.token',
              'req.body.card',
              'req.body.cvv',
            ],
            remove: true,
          },
          genReqId: (req) =>
            (req.headers['x-request-id'] as string) || crypto.randomUUID(),
        },
      }),
    }),
  ],
})
export class AppModule {}
