import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  ConversationSession,
  MAX_HISTORY_MESSAGES,
  SESSION_TTL_SECONDS,
  SessionMessage,
  VibeContentStage,
  sessionKey,
} from './interfaces/vibe.interface';

/**
 * Conversation state, split deliberately across two stores.
 *
 * Redis holds the working session (what the model is replayed on each turn) with
 * a 7-day TTL, because it is read and rewritten on every token burst and is
 * disposable. Postgres holds the durable transcript so a traveller can reopen a
 * conversation next month and so we can see what the concierge promised.
 *
 * If Redis is empty — evicted, restarted, or a week old — the session is rebuilt
 * from Postgres rather than losing the conversation.
 */
@Injectable()
export class ConversationStore {
  private readonly logger = new Logger(ConversationStore.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, title?: string): Promise<ConversationSession> {
    const conversation = await this.prisma.conversation.create({
      data: { userId, title: title ?? null },
      select: { id: true, title: true },
    });

    const session: ConversationSession = {
      conversationId: conversation.id,
      userId,
      title: conversation.title,
      messages: [],
      updatedAt: new Date().toISOString(),
    };

    await this.save(session);
    return session;
  }

  /** Loads a session the caller owns, rehydrating from Postgres when needed. */
  async load(userId: string, conversationId: string): Promise<ConversationSession> {
    const cached = await this.readCache(userId, conversationId);
    if (cached) {
      return cached;
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
        title: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: MAX_HISTORY_MESSAGES,
          select: {
            role: true,
            content: true,
            contentPayload: true,
            toolName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Conversation not found', 404);
    }
    if (conversation.userId !== userId) {
      throw new AppException(ErrorCode.FORBIDDEN, 'This conversation belongs to someone else', 403);
    }

    // Tool turns are not replayed from Postgres: their ids are gone, and an
    // orphaned tool message without its matching assistant call is rejected by
    // the provider. The assistant's prose already summarises what they found.
    const session: ConversationSession = {
      conversationId: conversation.id,
      userId,
      title: conversation.title,
      messages: conversation.messages
        .filter((message) => message.role === MessageRole.USER || message.role === MessageRole.ASSISTANT)
        .map((message) => ({
          role: message.role === MessageRole.USER ? 'user' : 'assistant',
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      updatedAt: new Date().toISOString(),
    };

    await this.save(session);
    this.logger.log(`Rehydrated conversation ${conversationId} from Postgres`);
    return session;
  }

  async listForUser(userId: string): Promise<
    { id: string; title: string | null; updatedAt: Date; messageCount: number }[]
  > {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      messageCount: conversation._count.messages,
    }));
  }

  /** Appends to the working session and mirrors durable turns into Postgres. */
  async append(
    session: ConversationSession,
    message: SessionMessage,
    options: { persist?: boolean; stage?: VibeContentStage; payload?: unknown } = {},
  ): Promise<void> {
    session.messages.push(message);
    // Keep the replay window bounded so a long chat cannot grow the prompt without limit.
    if (session.messages.length > MAX_HISTORY_MESSAGES) {
      session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);
    }
    session.updatedAt = new Date().toISOString();

    await this.save(session);

    if (options.persist === false) {
      return;
    }

    try {
      await this.prisma.message.create({
        data: {
          conversationId: session.conversationId,
          role: toPrismaRole(message.role),
          content: message.content,
          contentPayload:
            options.payload === undefined
              ? undefined
              : ({ stage: options.stage, payload: options.payload } as Prisma.InputJsonValue),
          toolName: message.name ?? null,
        },
      });
    } catch (error) {
      // A transcript write must never break a live conversation.
      this.logger.error(`Failed to persist message for ${session.conversationId}`, error as Error);
    }
  }

  /** Titles a conversation from the traveller's first sentence. */
  async ensureTitle(session: ConversationSession, firstUserMessage: string): Promise<void> {
    if (session.title) {
      return;
    }

    const title = firstUserMessage.trim().slice(0, 60) || 'New trip';
    session.title = title;
    await this.save(session);
    await this.prisma.conversation
      .update({ where: { id: session.conversationId }, data: { title } })
      .catch((error: unknown) => {
        this.logger.error('Failed to store conversation title', error as Error);
      });
  }

  async setDraftId(session: ConversationSession, draftId: string): Promise<void> {
    session.draftId = draftId;
    await this.save(session);
  }

  /** Full transcript for reopening a conversation in the UI. */
  async transcript(
    userId: string,
    conversationId: string,
  ): Promise<{
    id: string;
    title: string | null;
    messages: {
      role: MessageRole;
      content: string;
      contentPayload: unknown;
      createdAt: Date;
    }[];
  }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
        title: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { role: { in: [MessageRole.USER, MessageRole.ASSISTANT] } },
          select: { role: true, content: true, contentPayload: true, createdAt: true },
        },
      },
    });

    if (!conversation) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Conversation not found', 404);
    }
    if (conversation.userId !== userId) {
      throw new AppException(ErrorCode.FORBIDDEN, 'This conversation belongs to someone else', 403);
    }

    return {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
    };
  }

  private async readCache(
    userId: string,
    conversationId: string,
  ): Promise<ConversationSession | null> {
    try {
      return await this.redis.get<ConversationSession>(sessionKey(userId, conversationId));
    } catch (error) {
      this.logger.warn(`Session cache read failed, falling back to Postgres: ${String(error)}`);
      return null;
    }
  }

  private async save(session: ConversationSession): Promise<void> {
    try {
      await this.redis.set(
        sessionKey(session.userId, session.conversationId),
        session,
        SESSION_TTL_SECONDS,
      );
    } catch (error) {
      // Losing the cache costs a Postgres rehydrate, not the conversation.
      this.logger.warn(`Session cache write failed: ${String(error)}`);
    }
  }
}

function toPrismaRole(role: SessionMessage['role']): MessageRole {
  switch (role) {
    case 'user':
      return MessageRole.USER;
    case 'assistant':
      return MessageRole.ASSISTANT;
    case 'tool':
      return MessageRole.TOOL;
    default:
      return MessageRole.SYSTEM;
  }
}
