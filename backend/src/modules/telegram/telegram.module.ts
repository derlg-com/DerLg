import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { CommandHandler } from './handlers/command.handler';
import { CallbackHandler } from './handlers/callback.handler';
import { LocationHandler } from './handlers/location.handler';
import { MessageHandler } from './handlers/message.handler';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { BotSenderService } from './services/bot-sender.service';
import { SessionService } from './services/session.service';
import { BroadcastProcessor } from './jobs/broadcast.processor';
import { AssignmentTimeoutProcessor } from './jobs/assignment-timeout.processor';
import { LocationCleanupProcessor } from './jobs/location-cleanup.processor';

/**
 * Telegram driver bot, merged in from the standalone admin service.
 *
 * BullMQ needs its own Redis connection details, taken from the same env vars
 * the rest of the app uses so there is one Redis to configure. The queues run
 * on Redis DB `REDIS_DB` alongside the cache; BullMQ namespaces its keys, so
 * they do not collide with session or cache entries.
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL');
        if (url) {
          const parsed = new URL(url);
          return {
            connection: {
              host: parsed.hostname,
              port: Number(parsed.port || 6379),
              password: parsed.password || undefined,
              db: configService.get<number>('REDIS_DB', 0),
              // BullMQ requires this to be null, not a number, or blocking
              // commands used by its workers will abort mid-wait.
              maxRetriesPerRequest: null,
            },
          };
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
            db: configService.get<number>('REDIS_DB', 0),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'broadcast' },
      { name: 'assignment-timeout' },
      { name: 'location-cleanup' },
    ),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    CommandHandler,
    CallbackHandler,
    LocationHandler,
    MessageHandler,
    TelegramAuthGuard,
    BotSenderService,
    SessionService,
    BroadcastProcessor,
    AssignmentTimeoutProcessor,
    LocationCleanupProcessor,
  ],
  exports: [TelegramService, BotSenderService],
})
export class TelegramModule {}
