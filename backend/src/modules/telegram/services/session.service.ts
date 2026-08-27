import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export type SessionState = 'idle' | 'registration' | 'support_request';

export interface DriverSession {
  telegramId: string;
  state: SessionState;
  language: string;
  lastCommand: string;
  lastActivity: string;
  context?: {
    pendingAssignmentId?: string;
    activeTripId?: string;
    supportMessage?: string;
  };
}

@Injectable()
export class SessionService {
  private readonly ttlSeconds = 60 * 60; // 1 hour

  constructor(private readonly redis: RedisService) {}

  private key(telegramId: string): string {
    return `telegram_session:${telegramId}`;
  }

  async getSession(telegramId: string): Promise<DriverSession | null> {
    const data = await this.redis.getClient().hgetall(this.key(telegramId));

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      telegramId: data.telegramId || telegramId,
      state: (data.state as SessionState) || 'idle',
      language: data.language || 'en',
      lastCommand: data.lastCommand || '',
      lastActivity: data.lastActivity || new Date().toISOString(),
      // Redis hashes are string->string; the context field holds JSON.
      context: data.context
        ? (JSON.parse(data.context) as Record<string, unknown>)
        : undefined,
    };
  }

  async setSession(
    telegramId: string,
    state: SessionState,
    data?: Partial<DriverSession>,
  ): Promise<void> {
    const key = this.key(telegramId);
    const now = new Date().toISOString();

    await this.redis.getClient().hmset(key, {
      telegramId,
      state,
      language: data?.language || 'en',
      lastCommand: data?.lastCommand || '',
      lastActivity: now,
      context: data?.context ? JSON.stringify(data.context) : '{}',
    });

    await this.redis.getClient().expire(key, this.ttlSeconds);
  }

  async updateContext(
    telegramId: string,
    context: DriverSession['context'],
  ): Promise<void> {
    const key = this.key(telegramId);
    await this.redis
      .getClient()
      .hset(key, 'context', context ? JSON.stringify(context) : '{}');
    await this.redis.getClient().expire(key, this.ttlSeconds);
  }

  async clearSession(telegramId: string): Promise<void> {
    await this.redis.getClient().del(this.key(telegramId));
  }

  async setLanguage(telegramId: string, language: string): Promise<void> {
    const key = this.key(telegramId);
    await this.redis.getClient().hset(key, 'language', language);
    await this.redis.getClient().expire(key, this.ttlSeconds);
  }

  async getLanguage(telegramId: string): Promise<string> {
    const session = await this.getSession(telegramId);
    return session?.language || 'en';
  }
}
