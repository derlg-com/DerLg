import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ToolCall } from '../../llm/interfaces/llm.interface';
import { CheckAvailabilityArgsDto, SearchHotelsArgsDto } from './dto/tool-args.dto';
import { TOOL_TIMEOUT_MS, ToolExecutor, ToolOutcome } from './tool-executor';
import { RegisteredTool, ToolContext, ToolRegistry } from './tool-registry';

const context: ToolContext = { userId: 'user-1', conversationId: 'conv-1' };

function call(name: string, args: unknown, id = 'call_1'): ToolCall {
  return { id, name, arguments: typeof args === 'string' ? args : JSON.stringify(args) };
}

/** A registry stub so these tests exercise the executor, not the catalogue. */
function registryWith(tools: Record<string, RegisteredTool>): ToolRegistry {
  return {
    get: (name: string) => tools[name],
    has: (name: string) => name in tools,
    names: () => Object.keys(tools),
    definitions: () => Object.values(tools).map((tool) => tool.definition),
  } as unknown as ToolRegistry;
}

function stubTool(handler: RegisteredTool['handler']): RegisteredTool {
  return {
    argsType: SearchHotelsArgsDto,
    definition: { name: 'search_hotels', description: 'd', parameters: { type: 'object' } },
    handler,
  };
}

/** A tool whose arguments contain a nested array, to test structure coercion. */
function availabilityTool(handler: RegisteredTool['handler']): RegisteredTool {
  return {
    argsType: CheckAvailabilityArgsDto,
    definition: { name: 'check_availability', description: 'd', parameters: { type: 'object' } },
    handler,
  };
}

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let handler: jest.Mock;

  beforeEach(() => {
    handler = jest.fn().mockResolvedValue({ items: [] });
    executor = new ToolExecutor(registryWith({ search_hotels: stubTool(handler) }));
    jest.spyOn(executor['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(executor['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);
  });

  describe('argument handling', () => {
    it('passes validated arguments to the handler and reports success', async () => {
      handler.mockResolvedValue({ total: 2, items: [{ refId: 'h1' }] });

      const [outcome] = await executor.execute(
        [call('search_hotels', { city: 'siem-reap', maxPricePerNightUsd: 60 })],
        context,
      );

      expect(outcome).toMatchObject({
        callId: 'call_1',
        name: 'search_hotels',
        success: true,
        data: { total: 2, items: [{ refId: 'h1' }] },
      });
      expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'siem-reap', maxPricePerNightUsd: 60 }),
        context,
      );
    });

    it('coerces the stringified numbers llama actually sends', async () => {
      // Observed live on NVIDIA NIM: {"city":"siem-reap","maxPricePerNightUsd":"60"}
      const [outcome] = await executor.execute(
        [call('search_hotels', { city: 'siem-reap', maxPricePerNightUsd: '60' })],
        context,
      );

      expect(outcome.success).toBe(true);
      const [args] = handler.mock.calls[0] as [SearchHotelsArgsDto];
      expect(args.maxPricePerNightUsd).toBe(60);
      expect(typeof args.maxPricePerNightUsd).toBe('number');
    });

    it('accepts an empty argument object', async () => {
      const [outcome] = await executor.execute([call('search_hotels', {})], context);

      expect(outcome.success).toBe(true);
    });

    it('accepts empty arguments text as an empty object', async () => {
      const [outcome] = await executor.execute([call('search_hotels', '')], context);

      expect(outcome.success).toBe(true);
    });

    it('un-stringifies a nested structure sent as text', async () => {
      // Observed live: llama sends `days` as a JSON string, which made
      // compose_itinerary fail five times running with "days must be an array".
      executor = new ToolExecutor(
        registryWith({ check_availability: availabilityTool(handler) }),
      );
      jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);
      jest.spyOn(executor['logger'], 'warn').mockImplementation(() => undefined);

      const [outcome] = await executor.execute(
        [
          call('check_availability', {
            startDate: '2029-05-10',
            guests: 2,
            items: JSON.stringify([
              { dayNumber: 1, type: 'HOTEL', refId: '42191f62-224b-4e9c-8aab-8ded0cd52994' },
            ]),
          }),
        ],
        context,
      );

      expect(outcome.success).toBe(true);
      const [args] = handler.mock.calls[0] as [{ items: unknown[] }];
      expect(Array.isArray(args.items)).toBe(true);
      expect(args.items[0]).toMatchObject({ dayNumber: 1, type: 'HOTEL' });
    });

    it('repairs the Python-style pseudo-JSON llama actually writes', async () => {
      // Observed live: days arrived as
      //   "[{'dayNumber': 1, 'title': 'Day 1', 'items': [...]}]"
      // Correct structure, wrong quoting — worth repairing rather than discarding.
      executor = new ToolExecutor(
        registryWith({ check_availability: availabilityTool(handler) }),
      );
      jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);
      jest.spyOn(executor['logger'], 'warn').mockImplementation(() => undefined);

      const [outcome] = await executor.execute(
        [
          call('check_availability', {
            startDate: '2029-05-10',
            guests: '2',
            items:
              "[{'dayNumber': 1, 'type': 'HOTEL', 'refId': '42191f62-224b-4e9c-8aab-8ded0cd52994'},]",
          }),
        ],
        context,
      );

      expect(outcome.success).toBe(true);
      const [args] = handler.mock.calls[0] as [{ items: unknown[]; guests: number }];
      expect(args.items).toHaveLength(1);
      expect(args.items[0]).toMatchObject({ type: 'HOTEL' });
      expect(args.guests).toBe(2);
    });

    it('leaves ordinary prose alone even when it starts with a brace', async () => {
      const [outcome] = await executor.execute(
        [call('search_hotels', { city: '{not json after all' })],
        context,
      );

      expect(outcome.success).toBe(true);
      const [args] = handler.mock.calls[0] as [{ city: string }];
      expect(args.city).toBe('{not json after all');
    });

    it('rejects malformed JSON with guidance instead of throwing', async () => {
      const [outcome] = await executor.execute([call('search_hotels', '{"city":')], context);

      expect(outcome).toMatchObject({
        success: false,
        error: { code: 'MALFORMED_JSON' },
      });
      expect(outcome.error?.message).toMatch(/valid JSON/i);
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects a JSON array, which is never a valid argument object', async () => {
      const [outcome] = await executor.execute([call('search_hotels', '[1,2]')], context);

      expect(outcome.error?.code).toBe('INVALID_ARGUMENTS');
    });

    it('rejects an out-of-range value and tells the model how to fix it', async () => {
      const [outcome] = await executor.execute(
        [call('search_hotels', { minStars: 9 })],
        context,
      );

      expect(outcome).toMatchObject({ success: false, error: { code: 'INVALID_ARGUMENTS' } });
      expect(outcome.error?.message).toContain('minStars');
      expect(outcome.error?.message).toMatch(/call the tool again/i);
      expect(handler).not.toHaveBeenCalled();
    });

    it('strips a hallucinated parameter rather than passing it through', async () => {
      const [outcome] = await executor.execute(
        [call('search_hotels', { city: 'siem-reap', sqlInjection: "'; DROP TABLE hotels; --" })],
        context,
      );

      expect(outcome.success).toBe(true);
      const [args] = handler.mock.calls[0] as [Record<string, unknown>];
      expect(args).not.toHaveProperty('sqlInjection');
    });
  });

  describe('the whitelist boundary', () => {
    it('refuses a tool that is not registered and lists what is', async () => {
      const [outcome] = await executor.execute([call('drop_database', {})], context);

      expect(outcome).toMatchObject({ success: false, error: { code: 'UNKNOWN_TOOL' } });
      expect(outcome.error?.message).toContain('search_hotels');
      expect(handler).not.toHaveBeenCalled();
    });

    it('refuses a plausible-looking but unregistered write tool', async () => {
      const [outcome] = await executor.execute(
        [call('charge_card', { amountUsd: 1000 })],
        context,
      );

      expect(outcome.error?.code).toBe('UNKNOWN_TOOL');
    });
  });

  describe('failure isolation', () => {
    it('turns a thrown handler error into a failed outcome, never a rejection', async () => {
      handler.mockRejectedValue(new Error('connection reset by peer'));

      const [outcome] = await executor.execute([call('search_hotels', {})], context);

      expect(outcome).toMatchObject({ success: false, error: { code: 'EXECUTION_FAILED' } });
      // The internal message is logged, not handed to the model.
      expect(outcome.error?.message).not.toContain('connection reset');
    });

    it('passes a domain error through so the model can act on the real reason', async () => {
      handler.mockRejectedValue(
        new AppException(
          ErrorCode.CATALOG_UNKNOWN_REFERENCE,
          'These ids are not in our catalogue: made-up-id. Search again.',
          400,
        ),
      );

      const [outcome] = await executor.execute([call('search_hotels', {})], context);

      expect(outcome.error?.code).toBe('CATALOG_UNKNOWN_REFERENCE');
      expect(outcome.error?.message).toContain('made-up-id');
    });

    it('times out a hanging tool without hanging the turn', async () => {
      jest.useFakeTimers();
      handler.mockImplementation(() => new Promise(() => {}));

      const pending = executor.execute([call('search_hotels', {})], context);
      await jest.advanceTimersByTimeAsync(TOOL_TIMEOUT_MS + 10);
      const [outcome] = await pending;

      expect(outcome).toMatchObject({ success: false, error: { code: 'TIMEOUT' } });
      expect(outcome.error?.message).toMatch(/took too long/i);
      jest.useRealTimers();
    });

    it('lets one tool fail without affecting its siblings', async () => {
      const ok = jest.fn().mockResolvedValue({ items: ['fine'] });
      const bad = jest.fn().mockRejectedValue(new Error('boom'));
      executor = new ToolExecutor(
        registryWith({ search_hotels: stubTool(ok), search_guides: stubTool(bad) }),
      );
      jest.spyOn(executor['logger'], 'error').mockImplementation(() => undefined);
      jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);

      const outcomes = await executor.execute(
        [call('search_hotels', {}, 'c1'), call('search_guides', {}, 'c2')],
        context,
      );

      expect(outcomes.map((outcome) => outcome.success)).toEqual([true, false]);
      expect(outcomes.map((outcome) => outcome.callId)).toEqual(['c1', 'c2']);
    });
  });

  describe('parallelism', () => {
    it('runs independent calls concurrently rather than in series', async () => {
      let running = 0;
      let peak = 0;
      const slow = jest.fn().mockImplementation(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 20));
        running -= 1;
        return { ok: true };
      });

      executor = new ToolExecutor(
        registryWith({
          search_hotels: stubTool(slow),
          search_guides: stubTool(slow),
          search_places: stubTool(slow),
        }),
      );
      jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);

      const started = Date.now();
      await executor.execute(
        [
          call('search_hotels', {}, 'c1'),
          call('search_guides', {}, 'c2'),
          call('search_places', {}, 'c3'),
        ],
        context,
      );

      expect(peak).toBe(3);
      // Serial execution would take at least 60ms.
      expect(Date.now() - started).toBeLessThan(55);
    });

    it('preserves the order of outcomes so they can be paired with calls', async () => {
      executor = new ToolExecutor(
        registryWith({
          search_hotels: stubTool(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
            return { slow: true };
          }),
          search_guides: stubTool(() => Promise.resolve({ fast: true })),
        }),
      );
      jest.spyOn(executor['logger'], 'log').mockImplementation(() => undefined);

      const outcomes = await executor.execute(
        [call('search_hotels', {}, 'slow'), call('search_guides', {}, 'fast')],
        context,
      );

      expect(outcomes.map((outcome) => outcome.callId)).toEqual(['slow', 'fast']);
    });
  });

  describe('toToolMessageContent', () => {
    it('serialises a success for the model', () => {
      const outcome: ToolOutcome = {
        callId: 'c1',
        name: 'search_hotels',
        success: true,
        data: { total: 1 },
        durationMs: 5,
      };

      expect(ToolExecutor.toToolMessageContent(outcome)).toBe('{"success":true,"data":{"total":1}}');
    });

    it('serialises a failure so the model can read and react to it', () => {
      const outcome: ToolOutcome = {
        callId: 'c1',
        name: 'search_hotels',
        success: false,
        error: { code: 'INVALID_ARGUMENTS', message: 'minStars must not be greater than 5' },
        durationMs: 2,
      };

      const content = ToolExecutor.toToolMessageContent(outcome);
      expect(JSON.parse(content)).toEqual({
        success: false,
        error: { code: 'INVALID_ARGUMENTS', message: 'minStars must not be greater than 5' },
      });
    });
  });
});
