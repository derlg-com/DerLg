import { MessageRole } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConversationStore } from './conversation.store';
import {
  ConversationSession,
  MAX_HISTORY_MESSAGES,
  SESSION_TTL_SECONDS,
  sessionKey,
} from './interfaces/vibe.interface';

describe('ConversationStore', () => {
  let prisma: {
    conversation: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    message: { create: jest.Mock };
  };
  let redis: { get: jest.Mock; set: jest.Mock };
  let store: ConversationStore;

  beforeEach(() => {
    prisma = {
      conversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv-1', title: null }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      message: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
    };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    store = new ConversationStore(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
    );
    jest.spyOn(store['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(store['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(store['logger'], 'log').mockImplementation(() => undefined);
  });

  function session(overrides: Partial<ConversationSession> = {}): ConversationSession {
    return {
      conversationId: 'conv-1',
      userId: 'user-1',
      title: 'A trip',
      messages: [],
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('create', () => {
    it('writes the conversation to Postgres and caches the session for a week', async () => {
      const created = await store.create('user-1', 'Temples');

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'Temples' },
        select: { id: true, title: true },
      });
      expect(created).toMatchObject({ conversationId: 'conv-1', userId: 'user-1', messages: [] });
      expect(redis.set).toHaveBeenCalledWith(
        sessionKey('user-1', 'conv-1'),
        expect.objectContaining({ conversationId: 'conv-1' }),
        SESSION_TTL_SECONDS,
      );
    });
  });

  describe('load', () => {
    it('serves the cached session without touching Postgres', async () => {
      const cached = session({ messages: [{ role: 'user', content: 'hi', createdAt: 'now' }] });
      redis.get.mockResolvedValue(cached);

      const loaded = await store.load('user-1', 'conv-1');

      expect(loaded).toBe(cached);
      expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
    });

    it('rebuilds the session from Postgres when the cache has expired', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Temples',
        messages: [
          {
            role: MessageRole.USER,
            content: 'hi',
            contentPayload: null,
            toolName: null,
            createdAt: new Date('2026-01-01'),
          },
          {
            role: MessageRole.ASSISTANT,
            content: 'hello',
            contentPayload: null,
            toolName: null,
            createdAt: new Date('2026-01-02'),
          },
        ],
      });

      const loaded = await store.load('user-1', 'conv-1');

      expect(loaded.title).toBe('Temples');
      expect(loaded.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
      // Rehydrating re-warms the cache.
      expect(redis.set).toHaveBeenCalled();
    });

    it('drops persisted tool turns when rehydrating, because their call ids are gone', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        title: null,
        messages: [
          {
            role: MessageRole.USER,
            content: 'hi',
            contentPayload: null,
            toolName: null,
            createdAt: new Date(),
          },
          {
            role: MessageRole.TOOL,
            content: '{"success":true}',
            contentPayload: null,
            toolName: 'search_hotels',
            createdAt: new Date(),
          },
        ],
      });

      const loaded = await store.load('user-1', 'conv-1');

      // An orphaned tool message without its assistant call is rejected by the provider.
      expect(loaded.messages).toHaveLength(1);
      expect(loaded.messages[0].role).toBe('user');
    });

    it('reads through to Postgres when Redis is down', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        title: null,
        messages: [],
      });

      await expect(store.load('user-1', 'conv-1')).resolves.toMatchObject({
        conversationId: 'conv-1',
      });
    });

    it('404s an unknown conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(store.load('user-1', 'conv-1')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        status: 404,
      });
    });

    it('403s another user´s conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'someone-else',
        title: null,
        messages: [],
      });

      await expect(store.load('user-1', 'conv-1')).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        status: 403,
      });
    });
  });

  describe('append', () => {
    it('adds to the session and mirrors the turn into Postgres', async () => {
      const current = session();

      await store.append(current, { role: 'user', content: 'hello', createdAt: 'now' });

      expect(current.messages).toHaveLength(1);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: MessageRole.USER,
          content: 'hello',
          contentPayload: undefined,
          toolName: null,
        },
      });
    });

    it('stores the content panel so a reload can replay the cards', async () => {
      const current = session();

      await store.append(
        current,
        { role: 'assistant', content: 'Two hotels', createdAt: 'now' },
        { stage: 'hotels', payload: { items: [{ refId: 'h1' }] } },
      );

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: MessageRole.ASSISTANT,
          contentPayload: { stage: 'hotels', payload: { items: [{ refId: 'h1' }] } },
        }),
      });
    });

    it('keeps transient turns out of the transcript when asked', async () => {
      const current = session();

      await store.append(
        current,
        { role: 'tool', content: '{"success":true}', createdAt: 'now' },
        { persist: false },
      );

      expect(current.messages).toHaveLength(1);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('bounds the replay window so a long chat cannot grow the prompt forever', async () => {
      const current = session({
        messages: Array.from({ length: MAX_HISTORY_MESSAGES }, (_unused, index) => ({
          role: 'user' as const,
          content: `message ${index}`,
          createdAt: 'now',
        })),
      });

      await store.append(current, { role: 'user', content: 'newest', createdAt: 'now' });

      expect(current.messages).toHaveLength(MAX_HISTORY_MESSAGES);
      expect(current.messages.at(-1)?.content).toBe('newest');
      expect(current.messages[0].content).toBe('message 1');
    });

    it('does not break a live conversation when the transcript write fails', async () => {
      prisma.message.create.mockRejectedValue(new Error('disk full'));
      const current = session();

      await expect(
        store.append(current, { role: 'user', content: 'hello', createdAt: 'now' }),
      ).resolves.toBeUndefined();
      expect(current.messages).toHaveLength(1);
    });

    it('does not break a live conversation when the cache write fails', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'));
      const current = session();

      await expect(
        store.append(current, { role: 'user', content: 'hello', createdAt: 'now' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('ensureTitle', () => {
    it('titles an untitled conversation from the first sentence', async () => {
      const current = session({ title: null });

      await store.ensureTitle(current, '  I want three days around Angkor  ');

      expect(current.title).toBe('I want three days around Angkor');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { title: 'I want three days around Angkor' },
      });
    });

    it('truncates a long opening message', async () => {
      const current = session({ title: null });

      await store.ensureTitle(current, 'x'.repeat(200));

      expect(current.title).toHaveLength(60);
    });

    it('leaves an existing title alone', async () => {
      const current = session({ title: 'Existing' });

      await store.ensureTitle(current, 'something else');

      expect(current.title).toBe('Existing');
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('transcript', () => {
    it('returns the durable messages for the owner', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Temples',
        messages: [
          {
            role: MessageRole.USER,
            content: 'hi',
            contentPayload: null,
            createdAt: new Date(),
          },
        ],
      });

      const transcript = await store.transcript('user-1', 'conv-1');

      expect(transcript).toMatchObject({ id: 'conv-1', title: 'Temples' });
      expect(transcript.messages).toHaveLength(1);
    });

    it('refuses another user´s transcript', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'someone-else',
        title: null,
        messages: [],
      });

      await expect(store.transcript('user-1', 'conv-1')).rejects.toMatchObject({ status: 403 });
    });
  });
});
