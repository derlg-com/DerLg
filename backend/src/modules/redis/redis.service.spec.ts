import Redis from 'ioredis';

import { RedisService } from './redis.service';

/*
 * The constructor builds a real ioredis client, which would open a socket and
 * leave the Jest worker hanging ("failed to exit gracefully"). Stub the module so
 * construction is inert; the fake client is injected per test below.
 */
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    scanStream: jest.fn(),
    del: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  })),
}));

/**
 * `delByPattern` underpins two security-relevant behaviours — terminating a
 * suspended user's sessions and invalidating the public trip catalogue — so its
 * blast radius matters in both directions: it must remove everything matching,
 * and nothing that does not.
 *
 * SCAN rather than KEYS is deliberate. `KEYS` walks the whole keyspace in one
 * blocking call, which would stall live booking traffic during a catalogue edit.
 */
describe('RedisService.delByPattern', () => {
  let service: RedisService;
  let client: { scanStream: jest.Mock; del: jest.Mock };

  /** Minimal async-iterable stand-in for ioredis' scan stream. */
  function streamOf(chunks: string[][]) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      },
    };
  }

  beforeEach(() => {
    client = {
      scanStream: jest.fn(),
      del: jest.fn((...keys: string[]) => Promise.resolve(keys.length)),
    };
    // ioredis is mocked at module scope, so construction opens no socket.
    service = new RedisService({ get: () => undefined } as never);
    (service as unknown as { client: unknown }).client = client;
  });

  it('should return 0 and issue no delete when nothing matches', async () => {
    client.scanStream.mockReturnValue(streamOf([]));

    await expect(service.delByPattern('cat:trip:nothing:*')).resolves.toBe(0);
    expect(client.del).not.toHaveBeenCalled();
  });

  it('should delete every matching key in one batch when under the threshold', async () => {
    client.scanStream.mockReturnValue(
      streamOf([['cat:trip:list:en', 'cat:trip:detail:a:en']]),
    );

    await expect(service.delByPattern('cat:trip:*')).resolves.toBe(2);
    expect(client.del).toHaveBeenCalledTimes(1);
    expect(client.del).toHaveBeenCalledWith(
      'cat:trip:list:en',
      'cat:trip:detail:a:en',
    );
  });

  it('should pass the pattern through to SCAN rather than filtering client-side', async () => {
    client.scanStream.mockReturnValue(streamOf([]));

    await service.delByPattern('session:user-1:*');

    expect(client.scanStream).toHaveBeenCalledWith({
      match: 'session:user-1:*',
      count: 200,
    });
  });

  it('should flush in batches once the batch size is exceeded', async () => {
    // 250 keys with a batch size of 100 → two flushes inside the loop plus the
    // trailing remainder, proving the accumulator drains rather than growing
    // unboundedly on a large keyspace.
    const keys = Array.from({ length: 250 }, (_, i) => `cat:trip:list:${i}`);
    client.scanStream.mockReturnValue(
      streamOf([keys.slice(0, 120), keys.slice(120, 240), keys.slice(240)]),
    );

    await expect(service.delByPattern('cat:trip:*', 100)).resolves.toBe(250);
    expect(client.del.mock.calls.length).toBeGreaterThan(1);
  });

  it('should sum deletions across batches', async () => {
    client.scanStream.mockReturnValue(streamOf([['a'], ['b'], ['c']]));

    await expect(service.delByPattern('*', 1)).resolves.toBe(3);
  });
});

/**
 * The thin command wrappers. Cheap to test and worth it: `set` silently changes
 * command depending on whether a TTL is present, and a wrapper that dropped the
 * TTL would turn every 15-minute booking hold into a permanent one.
 */
describe('RedisService commands', () => {
  let service: RedisService;
  let client: {
    get: jest.Mock;
    set: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    client = {
      get: jest.fn().mockResolvedValue('cached'),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['a', 'b']),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    service = new RedisService({ get: () => undefined } as never);
    (service as unknown as { client: unknown }).client = client;
  });

  it('should pass GET through and return the raw value', async () => {
    await expect(service.get('k')).resolves.toBe('cached');
    expect(client.get).toHaveBeenCalledWith('k');
  });

  it('should return null for a miss rather than throwing', async () => {
    client.get.mockResolvedValue(null);

    await expect(service.get('k')).resolves.toBeNull();
  });

  it('should use SETEX when a TTL is given', async () => {
    await service.set('hold:bk-1', 'v', 900);

    // A plain SET here would make a 15-minute booking hold permanent.
    expect(client.setex).toHaveBeenCalledWith('hold:bk-1', 900, 'v');
    expect(client.set).not.toHaveBeenCalled();
  });

  it('should use plain SET when no TTL is given', async () => {
    await service.set('k', 'v');

    expect(client.set).toHaveBeenCalledWith('k', 'v');
    expect(client.setex).not.toHaveBeenCalled();
  });

  it('should treat a zero TTL as no expiry rather than expiring immediately', async () => {
    await service.set('k', 'v', 0);

    // Redis rejects SETEX with a 0 TTL, so falling through to SET is the only
    // non-throwing behaviour.
    expect(client.set).toHaveBeenCalledWith('k', 'v');
    expect(client.setex).not.toHaveBeenCalled();
  });

  it('should pass DEL through', async () => {
    await service.del('k');

    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('should pass SETEX through directly', async () => {
    await service.setex('k', 60, 'v');

    expect(client.setex).toHaveBeenCalledWith('k', 60, 'v');
  });

  it('should pass KEYS through and return the matches', async () => {
    await expect(service.keys('cat:*')).resolves.toEqual(['a', 'b']);
    expect(client.keys).toHaveBeenCalledWith('cat:*');
  });

  it('should expose the underlying client for callers needing raw commands', () => {
    expect(service.getClient()).toBe(client);
  });

  it('should quit the connection on shutdown so Nest can exit', async () => {
    await service.onModuleDestroy();

    expect(client.quit).toHaveBeenCalled();
  });
});

describe('RedisService connection config', () => {
  beforeEach(() => {
    (Redis as unknown as jest.Mock).mockClear();
  });

  it('should prefer REDIS_URL when present', () => {
    new RedisService({
      get: (key: string) =>
        key === 'REDIS_URL' ? 'redis://host:6380/2' : undefined,
    } as never);

    expect(Redis).toHaveBeenCalledWith('redis://host:6380/2', {
      maxRetriesPerRequest: 3,
    });
  });

  it('should fall back to discrete host/port config when REDIS_URL is absent', () => {
    const config: Record<string, unknown> = {
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6380,
      REDIS_PASSWORD: 'secret',
      REDIS_DB: 1,
    };

    new RedisService({
      get: (key: string, fallback?: unknown) => config[key] ?? fallback,
    } as never);

    expect(Redis).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 6380,
      password: 'secret',
      db: 1,
      maxRetriesPerRequest: 3,
    });
  });

  it('should apply localhost:6379 defaults when nothing is configured', () => {
    new RedisService({
      get: (_key: string, fallback?: unknown) => fallback,
    } as never);

    expect(Redis).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 6379, db: 0 }),
    );
  });

  it('should bound retries so a dead Redis fails fast instead of hanging requests', () => {
    new RedisService({ get: () => undefined } as never);

    const arg = (Redis as unknown as jest.Mock).mock.calls[0][0];
    expect(arg.maxRetriesPerRequest).toBe(3);
  });
});
