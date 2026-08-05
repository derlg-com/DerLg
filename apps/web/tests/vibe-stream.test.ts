import { describe, expect, it } from 'vitest';

import { parseFrames } from '@/hooks/use-vibe-stream';

describe('parseFrames', () => {
  it('reads a complete SSE frame', () => {
    const { events, rest } = parseFrames(
      'event: token\ndata: {"type":"token","delta":"Hello"}\n\n',
    );

    expect(events).toEqual([{ type: 'token', delta: 'Hello' }]);
    expect(rest).toBe('');
  });

  it('reads several frames arriving in one chunk', () => {
    const { events } = parseFrames(
      'event: token\ndata: {"type":"token","delta":"a"}\n\n' +
        'event: token\ndata: {"type":"token","delta":"b"}\n\n',
    );

    expect(events.map((event) => (event as { delta: string }).delta)).toEqual(['a', 'b']);
  });

  it('keeps a partial frame in the buffer until the rest arrives', () => {
    const first = parseFrames('event: token\ndata: {"type":"token","del');
    expect(first.events).toEqual([]);
    expect(first.rest).toBe('event: token\ndata: {"type":"token","del');

    const second = parseFrames(`${first.rest}ta":"split"}\n\n`);
    expect(second.events).toEqual([{ type: 'token', delta: 'split' }]);
  });

  it('ignores heartbeat comments', () => {
    const { events } = parseFrames(
      ': keep-alive\n\nevent: token\ndata: {"type":"token","delta":"x"}\n\n',
    );

    expect(events).toEqual([{ type: 'token', delta: 'x' }]);
  });

  it('skips a malformed frame rather than throwing', () => {
    const { events } = parseFrames(
      'event: token\ndata: {not json\n\nevent: done\ndata: {"type":"done","conversationId":"c","messageId":null,"iterations":1}\n\n',
    );

    expect(events).toEqual([
      { type: 'done', conversationId: 'c', messageId: null, iterations: 1 },
    ]);
  });

  it('carries content and tool_status events through intact', () => {
    const { events } = parseFrames(
      'event: tool_status\ndata: {"type":"tool_status","name":"search_hotels","status":"running","label":"Checking hotels…"}\n\n' +
        'event: content\ndata: {"type":"content","stage":"hotels","payload":{"items":[{"refId":"h1","name":"Lotus Lodge"}]}}\n\n',
    );

    expect(events[0]).toMatchObject({ type: 'tool_status', label: 'Checking hotels…' });
    expect(events[1]).toMatchObject({ type: 'content', stage: 'hotels' });
  });
});
