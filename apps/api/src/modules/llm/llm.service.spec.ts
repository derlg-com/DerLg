import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../../common/errors/error-codes';
import { LlmService } from './llm.service';

/**
 * The OpenAI SDK is mocked wholesale: these tests assert how DerLg assembles
 * requests and reassembles streamed responses, and never touch the network.
 */
const create = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create } } })),
}));

/** Builds an async iterable of provider chunks. */
function chunks(items: unknown[]): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

function textChunk(delta: string) {
  return { choices: [{ delta: { content: delta }, finish_reason: null }] };
}

function toolChunk(index: number, fields: { id?: string; name?: string; arguments?: string }) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              id: fields.id,
              function: { name: fields.name, arguments: fields.arguments },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

function configWith(overrides: Record<string, string | number | undefined> = {}): ConfigService {
  const values: Record<string, string | number | undefined> = {
    OPENAI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
    OPENAI_API_KEY: 'nvapi-test-key-value',
    OPENAI_MODEL: 'meta/llama-3.1-8b-instruct',
    OPENAI_TIMEOUT_MS: 60_000,
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

describe('LlmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when no API key is configured', () => {
    it('reports itself unconfigured instead of failing at construction', () => {
      const service = new LlmService(configWith({ OPENAI_API_KEY: undefined }));

      expect(service.isConfigured).toBe(false);
    });

    it('answers 503 AI_UNAVAILABLE rather than 500', async () => {
      const service = new LlmService(configWith({ OPENAI_API_KEY: undefined }));

      const iterate = async () => {
        for await (const _event of service.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
          // consume
        }
      };

      await expect(iterate()).rejects.toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE,
        status: 503,
      });
    });
  });

  describe('streaming', () => {
    let service: LlmService;

    beforeEach(() => {
      service = new LlmService(configWith());
    });

    it('emits each text delta in order and finishes with done', async () => {
      create.mockResolvedValue(
        chunks([
          textChunk('Angkor '),
          textChunk('Wat '),
          textChunk('at sunrise.'),
          { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } },
        ]),
      );

      const events = [];
      for await (const event of service.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', delta: 'Angkor ' },
        { type: 'text', delta: 'Wat ' },
        { type: 'text', delta: 'at sunrise.' },
        {
          type: 'done',
          finishReason: 'stop',
          usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
        },
      ]);
    });

    it('assembles a tool call split across deltas into one complete call', async () => {
      create.mockResolvedValue(
        chunks([
          toolChunk(0, { id: 'call_abc', name: 'search_hotels', arguments: '{"city":' }),
          toolChunk(0, { arguments: '"siem-reap"}' }),
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        ]),
      );

      const events = [];
      for await (const event of service.stream({
        messages: [{ role: 'user', content: 'hotels please' }],
        tools: [
          { name: 'search_hotels', description: 'Find hotels', parameters: { type: 'object', properties: {} } },
        ],
      })) {
        events.push(event);
      }

      expect(events[0]).toEqual({
        type: 'tool_calls',
        calls: [{ id: 'call_abc', name: 'search_hotels', arguments: '{"city":"siem-reap"}' }],
      });
      expect(events[1]).toMatchObject({ type: 'done', finishReason: 'tool_calls' });
    });

    it('keeps parallel tool calls separate and ordered by index', async () => {
      create.mockResolvedValue(
        chunks([
          toolChunk(0, { id: 'c0', name: 'search_hotels', arguments: '{"city":"siem-reap"}' }),
          toolChunk(1, { id: 'c1', name: 'search_guides', arguments: '{"language":"Mandarin"}' }),
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        ]),
      );

      const { toolCalls } = await service.complete({ messages: [{ role: 'user', content: 'x' }] });

      expect(toolCalls.map((call) => call.name)).toEqual(['search_hotels', 'search_guides']);
      expect(toolCalls[1].arguments).toBe('{"language":"Mandarin"}');
    });

    it('synthesises an id when the provider omits one', async () => {
      create.mockResolvedValue(
        chunks([
          toolChunk(0, { name: 'search_places', arguments: '{}' }),
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        ]),
      );

      const { toolCalls } = await service.complete({ messages: [{ role: 'user', content: 'x' }] });

      expect(toolCalls[0].id).toBe('call_0');
    });

    it('defaults empty tool arguments to an empty object', async () => {
      create.mockResolvedValue(
        chunks([toolChunk(0, { id: 'c', name: 'list_cities' }), { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }]),
      );

      const { toolCalls } = await service.complete({ messages: [{ role: 'user', content: 'x' }] });

      expect(toolCalls[0].arguments).toBe('{}');
    });

    it('translates DerLg messages into the provider shape, including tool turns', async () => {
      create.mockResolvedValue(chunks([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));

      await service.complete({
        messages: [
          { role: 'system', content: 'You are a concierge.' },
          { role: 'user', content: 'hotels?' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'c1', name: 'search_hotels', arguments: '{"city":"siem-reap"}' }],
          },
          { role: 'tool', content: '{"items":[]}', toolCallId: 'c1', name: 'search_hotels' },
        ],
      });

      const [params] = create.mock.calls[0] as [Record<string, unknown>];
      const messages = params.messages as Array<Record<string, unknown>>;

      expect(messages[0]).toEqual({ role: 'system', content: 'You are a concierge.' });
      expect(messages[2]).toMatchObject({
        role: 'assistant',
        // An assistant turn with no prose must send null, not '' — some providers reject ''.
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'search_hotels', arguments: '{"city":"siem-reap"}' } },
        ],
      });
      expect(messages[3]).toEqual({ role: 'tool', content: '{"items":[]}', tool_call_id: 'c1' });
    });

    it('advertises tools with tool_choice auto and omits both when there are none', async () => {
      create.mockResolvedValue(chunks([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));

      await service.complete({
        messages: [{ role: 'user', content: 'x' }],
        tools: [{ name: 'search_hotels', description: 'd', parameters: { type: 'object' } }],
      });
      const [withTools] = create.mock.calls[0] as [Record<string, unknown>];
      expect(withTools.tool_choice).toBe('auto');
      expect(withTools.tools).toHaveLength(1);

      create.mockResolvedValue(chunks([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));
      await service.complete({ messages: [{ role: 'user', content: 'x' }] });
      const [withoutTools] = create.mock.calls[1] as [Record<string, unknown>];
      expect(withoutTools.tools).toBeUndefined();
      expect(withoutTools.tool_choice).toBeUndefined();
    });

    it('requests a stream with usage accounting', async () => {
      create.mockResolvedValue(chunks([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));

      await service.complete({ messages: [{ role: 'user', content: 'x' }] });

      const [params] = create.mock.calls[0] as [Record<string, unknown>];
      expect(params).toMatchObject({
        model: 'meta/llama-3.1-8b-instruct',
        stream: true,
        stream_options: { include_usage: true },
      });
    });

    it('honours a per-request model override', async () => {
      create.mockResolvedValue(chunks([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));

      await service.complete({
        messages: [{ role: 'user', content: 'x' }],
        model: 'meta/llama-3.1-70b-instruct',
      });

      const [params] = create.mock.calls[0] as [{ model: string }];
      expect(params.model).toBe('meta/llama-3.1-70b-instruct');
    });
  });

  describe('resilience', () => {
    let service: LlmService;

    beforeEach(() => {
      service = new LlmService(configWith());
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    });

    it('retries once when the request fails before any output', async () => {
      create
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce(chunks([textChunk('Recovered.'), { choices: [{ delta: {}, finish_reason: 'stop' }] }]));

      const { text } = await service.complete({ messages: [{ role: 'user', content: 'x' }] });

      expect(create).toHaveBeenCalledTimes(2);
      expect(text).toBe('Recovered.');
    });

    it('gives up after one retry rather than hammering the provider', async () => {
      create.mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.complete({ messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE,
      });
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('does not retry once text has already been emitted, to avoid duplicates', async () => {
      create.mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield textChunk('Half a sen');
          throw new Error('connection dropped mid-stream');
        },
      });

      const collected: string[] = [];
      const iterate = async () => {
        for await (const event of service.stream({ messages: [{ role: 'user', content: 'x' }] })) {
          if (event.type === 'text') collected.push(event.delta);
        }
      };

      await expect(iterate()).rejects.toMatchObject({ code: ErrorCode.AI_UNAVAILABLE });
      expect(create).toHaveBeenCalledTimes(1);
      expect(collected).toEqual(['Half a sen']);
    });

    it('reports a timeout in traveller-facing language without leaking internals', async () => {
      create.mockRejectedValue(new Error('Request timed out after 60000ms'));

      const error = await service
        .complete({ messages: [{ role: 'user', content: 'x' }] })
        .then(() => null)
        .catch((caught: { message: string; code: string }) => caught);

      expect(error?.code).toBe(ErrorCode.AI_UNAVAILABLE);
      expect(error?.message).toBe('The concierge took too long to answer. Please try again.');
      expect(error?.message).not.toContain('60000');
    });

    it('never puts the provider URL or key into the error message', async () => {
      create.mockRejectedValue(new Error('401 Unauthorized from https://integrate.api.nvidia.com/v1 key nvapi-secret'));

      const error = await service
        .complete({ messages: [{ role: 'user', content: 'x' }] })
        .then(() => null)
        .catch((caught: { message: string }) => caught);

      expect(error?.message).not.toContain('nvapi');
      expect(error?.message).not.toContain('nvidia.com');
    });
  });

  describe('parallel tool turns', () => {
    /** Shape of what we hand the SDK, for assertions. */
    type Sent = {
      role: string;
      content: string | null;
      tool_calls?: { id: string }[];
      tool_call_id?: string;
    };

    function sentMessages(): Sent[] {
      return (create.mock.calls[0][0] as { messages: Sent[] }).messages;
    }

    it('splits a multi-call assistant turn into single-call turns', async () => {
      // NVIDIA's llama template rejects replayed parallel calls outright:
      // "This model only supports single tool-calls at once!" (HTTP 500). That
      // broke every follow-up after a parallel search.
      const service = new LlmService(configWith());
      create.mockResolvedValue(chunks([textChunk('ok'), { choices: [{ finish_reason: 'stop' }] }]));

      await service.complete({
        messages: [
          { role: 'user', content: 'hotels and guides' },
          {
            role: 'assistant',
            content: 'Looking…',
            toolCalls: [
              { id: 'c1', name: 'search_hotels', arguments: '{}' },
              { id: 'c2', name: 'search_guides', arguments: '{}' },
            ],
          },
          { role: 'tool', content: '{"hotels":1}', toolCallId: 'c1', name: 'search_hotels' },
          { role: 'tool', content: '{"guides":1}', toolCallId: 'c2', name: 'search_guides' },
        ],
      });

      const sent = sentMessages();
      expect(sent.map((message) => message.role)).toEqual([
        'user',
        'assistant',
        'tool',
        'assistant',
        'tool',
      ]);
      for (const message of sent) {
        expect(message.tool_calls?.length ?? 0).toBeLessThanOrEqual(1);
      }
      // Each result immediately follows its own call.
      expect(sent[1].tool_calls?.[0].id).toBe('c1');
      expect(sent[2].tool_call_id).toBe('c1');
      expect(sent[3].tool_calls?.[0].id).toBe('c2');
      expect(sent[4].tool_call_id).toBe('c2');
      // The prose belongs to the first fragment only, never duplicated.
      expect(sent[1].content).toBe('Looking…');
      expect(sent[3].content).toBeNull();
    });

    it('leaves a single-call turn untouched', async () => {
      const service = new LlmService(configWith());
      create.mockResolvedValue(chunks([textChunk('ok'), { choices: [{ finish_reason: 'stop' }] }]));

      await service.complete({
        messages: [
          { role: 'user', content: 'hotels' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'c1', name: 'search_hotels', arguments: '{}' }],
          },
          { role: 'tool', content: '{}', toolCallId: 'c1', name: 'search_hotels' },
        ],
      });

      expect(sentMessages().map((message) => message.role)).toEqual([
        'user',
        'assistant',
        'tool',
      ]);
    });
  });
});
