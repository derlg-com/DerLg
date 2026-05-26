import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Global database singleton. Extends PrismaClient so all query methods
 * are available directly while managing the connection lifecycle.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (e) {
      console.warn('[PrismaService] DB connect failed at startup (will retry on first query):', (e as Error).message.slice(0, 120));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
