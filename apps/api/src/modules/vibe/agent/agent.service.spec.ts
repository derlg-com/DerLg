import { ErrorCode } from '../../../common/errors/error-codes';
import { LlmStreamEvent, ToolCall } from '../../llm/interfaces/llm.interface';
import { LlmService } from '../../llm/llm.service';
import { ConversationStore } from '../conversation.store';
import { ConversationSession, MAX_AGENT_ITERATIONS, VibeEvent } from '../interfaces/vibe.interface';
import { ToolExecutor, ToolOutcome } from '../tools/tool-executor';
import { ToolRegistry } from '../tools/tool-registry';
import { AgentService } from './agent.service';

function session(): ConversationSession {
  return {
    conversationId: 'conv-1',
    userId: 'user-1',
    title: null,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Builds a stream that yields the given events, one turn per call. */
function llmStub(turns: LlmStreamEvent[][], configured = true) {
  let turn = 0;
  const captured: unknown[] = [];

  const stream = jest.fn().mockImplementation(function* (request: unknown) {
    captured.push(request);
    const events = turns[Math.min(turn, turns.length - 1)];
    turn += 1;
    for (const event of events) {
      yield event;
    }
  });

  return {
    service: {
      isConfigured: configured,
      stream,
      complete: jest.fn().mockResolvedValue({ text: 'Closing thoughts.', toolCalls: [] }),
    } as unknown as LlmService,
    stream,
    captured,
    turnCount: () => turn,
  };
}

function text(...deltas: string[]): LlmStreamEvent[] {
  return [
    ...deltas.map((delta) => ({ type: 'text' as const, delta })),
    { type: 'done' as const, finishReason: 'stop' },
  ];
}

function toolTurn(calls: ToolCall[]): LlmStreamEvent[] {
  return [
    { type: 'tool_calls', calls },
    { type: 'done', finishReason: 'tool_calls' },
  ];
}

function storeStub() {
  return {
    ensureTitle: jest.fn().mockResolvedValue(undefined),
    append: jest.fn().mockResolvedValue(undefined),
    setDraftId: jest.fn().mockResolvedValue(undefined),
  } as unknown as ConversationStore & {
    ensureTitle: jest.Mock;
    append: jest.Mock;
  };
}

function registryStub(names = ['search_hotels', 'search_guides']) {
  return {
    names: () => names,
    definitions: () => names.map((name) => ({ name, description: name, parameters: {} })),
    get: () => undefined,
    has: (name: string) => names.includes(name),
  } as unknown as ToolRegistry;
}

function executorStub(outcomes: ToolOutcome[][]) {
  let call = 0;
  const execute = jest.fn().mockImplementation(() => {
    const result = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;
    return Promise.resolve(result);
  });
  return { service: { execute } as unknown as ToolExecutor, execute };
}

function outcome(partial: Partial<ToolOutcome> & { name: string }): ToolOutcome {
  return {
    callId: 'call_1',
    success: true,
    durationMs: 10,
    data: { items: [] },
    ...partial,
  };
}

async function collect(generator: AsyncGenerator<VibeEvent>): Promise<VibeEvent[]> {
  const events: VibeEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe('AgentService', () => {
  it('refuses to run when the model is not configured', async () => {
    const llm = llmStub([text('hi')], false);
    const agent = new AgentService(
      llm.service,
      registryStub(),
      executorStub([[]]).service,
      storeStub(),
    );

    await expect(collect(agent.run(session(), 'hello'))).rejects.toMatchObject({
      code: ErrorCode.AI_UNAVAILABLE,
      status: 503,
    });
  });

  it('streams a plain answer as tokens then done, without calling tools', async () => {
    const llm = llmStub([text('Bayon ', 'is ', 'beautiful.')]);
    const executor = executorStub([[]]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'Tell me about Bayon'));

    expect(events.filter((event) => event.type === 'token').map((event) => event.delta)).toEqual([
      'Bayon ',
      'is ',
      'beautiful.',
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'done', conversationId: 'conv-1', iterations: 1 });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('runs the tools the model asks for, then streams the follow-up answer', async () => {
    const llm = llmStub([
      toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{"city":"siem-reap"}' }]),
      text('Lotus Lodge is $28 a night.'),
    ]);
    const executor = executorStub([
      [outcome({ name: 'search_hotels', data: { items: [{ refId: 'h1', name: 'Lotus Lodge' }] } })],
    ]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'cheap hotels in siem reap'));

    expect(executor.execute).toHaveBeenCalledTimes(1);
    const types = events.map((event) => event.type);
    expect(types).toEqual(['tool_status', 'tool_status', 'content', 'token', 'done']);
    expect(events[0]).toMatchObject({ status: 'running', name: 'search_hotels' });
    expect(events[1]).toMatchObject({ status: 'done', name: 'search_hotels', durationMs: 10 });
    expect(events.at(-1)).toMatchObject({ iterations: 2 });
  });

  it('describes the work in progress in language a traveller understands', async () => {
    const llm = llmStub([
      toolTurn([
        { id: 'c1', name: 'search_hotels', arguments: '{"city":"siem-reap"}' },
        { id: 'c2', name: 'search_guides', arguments: '{"language":"Mandarin"}' },
      ]),
      text('Found both.'),
    ]);
    const executor = executorStub([
      [
        outcome({ name: 'search_hotels', callId: 'c1' }),
        outcome({ name: 'search_guides', callId: 'c2' }),
      ],
    ]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'hotel and guide'));
    const running = events.filter(
      (event) => event.type === 'tool_status' && event.status === 'running',
    );

    expect(running).toHaveLength(2);
    expect(running[0]).toMatchObject({ label: 'Checking hotels in Siem Reap…' });
    expect(running[1]).toMatchObject({ label: 'Finding a Mandarin-speaking guide…' });
    // No internal vocabulary leaks into the UI.
    for (const event of running) {
      expect(event.type === 'tool_status' && event.label).not.toMatch(/refId|tool|json/i);
    }
  });

  it('emits a content panel built from the tool data, not from model prose', async () => {
    const items = [{ refId: 'h1', name: 'Lotus Lodge', pricePerNightUsd: 28 }];
    const llm = llmStub([
      toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }]),
      text('Here you go.'),
    ]);
    const executor = executorStub([[outcome({ name: 'search_hotels', data: { items } })]]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'hotels'));
    const content = events.find((event) => event.type === 'content');

    expect(content).toMatchObject({ type: 'content', stage: 'hotels', payload: { items } });
  });

  it('prefers the most decisive panel when several tools ran', async () => {
    const llm = llmStub([
      toolTurn([
        { id: 'c1', name: 'search_hotels', arguments: '{}' },
        { id: 'c2', name: 'check_availability', arguments: '{}' },
      ]),
      text('All available.'),
    ]);
    const executor = executorStub([
      [
        outcome({ name: 'search_hotels', callId: 'c1', data: { items: [] } }),
        outcome({ name: 'check_availability', callId: 'c2', data: { available: true } }),
      ],
    ]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'is it free'));
    const content = events.find((event) => event.type === 'content');

    expect(content).toMatchObject({ stage: 'availability', payload: { available: true } });
  });

  it('reports a failed tool to the UI and hands the reason back to the model', async () => {
    const llm = llmStub([
      toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }]),
      text('Let me try something else.'),
    ]);
    const executor = executorStub([
      [
        outcome({
          name: 'search_hotels',
          success: false,
          data: undefined,
          error: { code: 'INVALID_ARGUMENTS', message: 'minStars must not be greater than 5' },
        }),
      ],
    ]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'hotels'));

    expect(events.find((event) => event.type === 'tool_status' && event.status === 'failed'))
      .toMatchObject({ label: 'minStars must not be greater than 5' });
    // No content panel for a failed lookup.
    expect(events.some((event) => event.type === 'content')).toBe(false);

    // The failure was fed back as a tool message so the model can recover.
    const secondRequest = llm.captured[1] as { messages: { role: string; content: string }[] };
    const toolMessage = secondRequest.messages.find((message) => message.role === 'tool');
    expect(toolMessage?.content).toContain('INVALID_ARGUMENTS');
  });

  it('stops after the iteration cap and still produces an answer', async () => {
    // A model that asks for tools forever.
    const llm = llmStub([toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }])]);
    const executor = executorStub([[outcome({ name: 'search_hotels' })]]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());
    jest.spyOn(agent['logger'], 'warn').mockImplementation(() => undefined);

    const events = await collect(agent.run(session(), 'loop forever'));

    expect(llm.turnCount()).toBe(MAX_AGENT_ITERATIONS);
    expect(executor.execute).toHaveBeenCalledTimes(MAX_AGENT_ITERATIONS);
    expect(events.at(-1)).toMatchObject({ type: 'done', iterations: MAX_AGENT_ITERATIONS });
    // The forced closing answer reached the traveller.
    expect(events.filter((event) => event.type === 'token').map((event) => event.delta)).toContain(
      'Closing thoughts.',
    );
  });

  it('never ends a turn silently when tools produced a panel but the model said nothing', async () => {
    const llm = llmStub([
      toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }]),
      [{ type: 'done', finishReason: 'stop' }],
    ]);
    const executor = executorStub([[outcome({ name: 'search_hotels' })]]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());

    const events = await collect(agent.run(session(), 'hotels'));
    const tokens = events.filter((event) => event.type === 'token');

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ delta: 'Here is what I found.' });
  });

  it('replaces a stray fragment left by a suppressed tool-call leak', async () => {
    // The model wrote its call as prose; the gate dropped it and left ";".
    const llm = llmStub([
      toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }]),
      text('{"name": "search_hotels", "parameters": {}}', ';'),
    ]);
    const executor = executorStub([[outcome({ name: 'search_hotels' })]]);
    const agent = new AgentService(llm.service, registryStub(), executor.service, storeStub());
    jest.spyOn(agent['logger'], 'warn').mockImplementation(() => undefined);

    const events = await collect(agent.run(session(), 'hotels'));
    const shown = events
      .filter((event) => event.type === 'token')
      .map((event) => (event as { delta: string }).delta)
      .join('');

    expect(shown).not.toContain('parameters');
    expect(shown).toBe('Here is what I found.');
  });

  it('apologises rather than going silent when nothing worked at all', async () => {
    const llm = llmStub([[{ type: 'done', finishReason: 'stop' }]]);
    const agent = new AgentService(
      llm.service,
      registryStub(),
      executorStub([[]]).service,
      storeStub(),
    );

    const events = await collect(agent.run(session(), 'hello?'));
    const tokens = events.filter((event) => event.type === 'token');

    expect(tokens).toHaveLength(1);
    expect((tokens[0] as { delta: string }).delta).toMatch(/could not get that done/i);
  });

  describe('conversation state', () => {
    it('titles the conversation and stores both turns', async () => {
      const store = storeStub();
      const llm = llmStub([text('Hello!')]);
      const agent = new AgentService(llm.service, registryStub(), executorStub([[]]).service, store);

      await collect(agent.run(session(), 'I want to see Angkor Wat'));

      expect(store.ensureTitle).toHaveBeenCalledWith(
        expect.anything(),
        'I want to see Angkor Wat',
      );
      expect(store.append).toHaveBeenCalledTimes(2);
      expect(store.append.mock.calls[0][1]).toMatchObject({
        role: 'user',
        content: 'I want to see Angkor Wat',
      });
      expect(store.append.mock.calls[1][1]).toMatchObject({
        role: 'assistant',
        content: 'Hello!',
      });
    });

    it('stores the panel alongside the assistant turn so a reload can replay it', async () => {
      const store = storeStub();
      const llm = llmStub([
        toolTurn([{ id: 'c1', name: 'search_hotels', arguments: '{}' }]),
        text('Two options.'),
      ]);
      const executor = executorStub([[outcome({ name: 'search_hotels', data: { items: [1] } })]]);
      const agent = new AgentService(llm.service, registryStub(), executor.service, store);

      await collect(agent.run(session(), 'hotels'));

      const [, message, options] = store.append.mock.calls[1] as [
        unknown,
        { content_stage?: { stage: string } },
        { stage?: string; payload?: unknown },
      ];
      expect(message.content_stage).toMatchObject({ stage: 'hotels' });
      expect(options).toMatchObject({ stage: 'hotels', payload: { items: [1] } });
    });

    it('sends the system prompt and prior turns, but never tool scaffolding, as history', async () => {
      const existing = session();
      existing.messages = [
        { role: 'user', content: 'earlier question', createdAt: new Date().toISOString() },
        { role: 'assistant', content: 'earlier answer', createdAt: new Date().toISOString() },
        {
          role: 'tool',
          content: '{"success":true}',
          name: 'search_hotels',
          createdAt: new Date().toISOString(),
        },
      ];
      const llm = llmStub([text('ok')]);
      const agent = new AgentService(
        llm.service,
        registryStub(),
        executorStub([[]]).service,
        storeStub(),
      );

      await collect(agent.run(existing, 'follow up'));

      const request = llm.captured[0] as { messages: { role: string; content: string }[] };
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[0].content).toContain('NEVER invent a hotel');
      expect(request.messages.map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
      ]);
      expect(request.messages.some((message) => message.content === '{"success":true}')).toBe(false);
    });

    it('replays what was already shown so a follow-up can be answered from it', async () => {
      const existing = session();
      existing.messages = [
        { role: 'user', content: 'hotels in siem reap', createdAt: new Date().toISOString() },
        {
          role: 'assistant',
          content: 'I found two.',
          createdAt: new Date().toISOString(),
          content_stage: {
            stage: 'hotels',
            payload: {
              items: [
                { refId: 'h-lotus', name: 'Lotus Lodge', pricePerNightUsd: 28 },
                { refId: 'h-terrace', name: 'Angkor Terrace Hotel', pricePerNightUsd: 54 },
              ],
            },
          },
        },
      ];
      const llm = llmStub([text('The Lotus Lodge at $28.')]);
      const agent = new AgentService(
        llm.service,
        registryStub(),
        executorStub([[]]).service,
        storeStub(),
      );

      await collect(agent.run(existing, 'book the cheaper one'));

      const request = llm.captured[0] as { messages: { role: string; content: string }[] };
      const assistantTurn = request.messages.find((message) => message.role === 'assistant');
      // Without this the model forgets the items and searches again.
      expect(assistantTurn?.content).toContain('Lotus Lodge (refId h-lotus, $28)');
      expect(assistantTurn?.content).toContain('Angkor Terrace Hotel (refId h-terrace, $54)');
      expect(assistantTurn?.content).toContain('I found two.');
    });

    it('passes the tool schemas and the abort signal to the model', async () => {
      const llm = llmStub([text('ok')]);
      const agent = new AgentService(
        llm.service,
        registryStub(['search_hotels']),
        executorStub([[]]).service,
        storeStub(),
      );
      const controller = new AbortController();

      await collect(agent.run(session(), 'hi', controller.signal));

      expect(llm.captured[0]).toMatchObject({
        tools: [{ name: 'search_hotels' }],
        signal: controller.signal,
      });
    });
  });
});
