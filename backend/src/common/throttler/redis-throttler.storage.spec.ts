import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisService } from '../../modules/redis/redis.service';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let evalMock: jest.Mock;

  beforeEach(() => {
    evalMock = jest.fn();
    const redis = {
      getClient: () => ({ eval: evalMock }),
    } as unknown as RedisService;
    storage = new RedisThrottlerStorage(redis);
  });

  it('converts the script result from milliseconds to seconds', async () => {
    // The guard puts timeToExpire in X-RateLimit-Reset and timeToBlockExpire in
    // Retry-After, both of which are second-granularity per RFC 6585.
    evalMock.mockResolvedValue([3, 45_000, 0, 0]);

    const record = await storage.increment(
      'key',
      60_000,
      10,
      60_000,
      'default',
    );

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('rounds partial seconds up so a caller never retries too early', async () => {
    evalMock.mockResolvedValue([11, 1, 1, 1200]);

    const record = await storage.increment(
      'key',
      60_000,
      10,
      60_000,
      'default',
    );

    expect(record.timeToExpire).toBe(1);
    expect(record.timeToBlockExpire).toBe(2);
    expect(record.isBlocked).toBe(true);
  });

  it('namespaces keys by throttler so named limiters cannot share a counter', async () => {
    evalMock.mockResolvedValue([1, 60_000, 0, 0]);

    await storage.increment('abc', 60_000, 10, 60_000, 'default');

    const [, numKeys, hitsKey, blockKey] = evalMock.mock.calls[0];
    expect(numKeys).toBe(2);
    expect(hitsKey).toBe('throttle:default:abc');
    expect(blockKey).toBe('throttle:default:abc:blocked');
  });

  it('passes ttl as the block duration when none is supplied', async () => {
    evalMock.mockResolvedValue([1, 60_000, 0, 0]);

    await storage.increment('abc', 60_000, 10, 0, 'default');

    const args = evalMock.mock.calls[0];
    expect(args[args.length - 1]).toBe('60000');
  });

  it('fails open when Redis is unavailable', async () => {
    // Rate limiting is protective. Rejecting every request because the limiter
    // cannot be consulted would turn a Redis blip into a full API outage.
    evalMock.mockRejectedValue(new Error('connection refused'));

    const record = await storage.increment(
      'key',
      60_000,
      10,
      60_000,
      'default',
    );

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(0);
    expect(record.timeToExpire).toBe(60);
  });

  it('logs the outage once, not once per request', async () => {
    const errorSpy = jest
      .spyOn(storage['logger'], 'error')
      .mockImplementation(() => undefined);
    evalMock.mockRejectedValue(new Error('connection refused'));

    await storage.increment('a', 60_000, 10, 60_000, 'default');
    await storage.increment('b', 60_000, 10, 60_000, 'default');
    await storage.increment('c', 60_000, 10, 60_000, 'default');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('reports recovery after a failure', async () => {
    const logSpy = jest
      .spyOn(storage['logger'], 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(storage['logger'], 'error').mockImplementation(() => undefined);

    evalMock.mockRejectedValueOnce(new Error('down'));
    await storage.increment('a', 60_000, 10, 60_000, 'default');

    evalMock.mockResolvedValue([1, 60_000, 0, 0]);
    await storage.increment('a', 60_000, 10, 60_000, 'default');

    expect(logSpy).toHaveBeenCalledWith('Redis rate-limit store recovered');
  });
});
