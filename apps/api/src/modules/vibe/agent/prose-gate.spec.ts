import { ProseGate } from './prose-gate';

/** Streams text through the gate the way the agent does, in small chunks. */
function through(text: string, chunkSize = 7): string {
  const gate = new ProseGate();
  let out = '';
  for (let index = 0; index < text.length; index += chunkSize) {
    out += gate.push(text.slice(index, index + chunkSize)) ?? '';
  }
  return out + (gate.flush() ?? '');
}

describe('ProseGate', () => {
  it('passes ordinary prose through unchanged', () => {
    const text = 'I found two hotels in Siem Reap. The Lotus Lodge costs $28 per night.';

    expect(through(text)).toBe(text);
  });

  it('passes the first delta straight through so streaming stays immediate', () => {
    const gate = new ProseGate();

    expect(gate.push('I found ')).toBe('I found ');
    expect(gate.push('two hotels.')).toBe('two hotels.');
  });

  it('suppresses a tool call the model leaked into the chat', () => {
    // Observed live from llama-3.1-8b.
    const leaked = '{"name": "search_places", "parameters": {"city": "siem-reap", "limit": "10"}}';

    expect(through(leaked)).toBe('');
  });

  it('suppresses a leaked call written with single quotes', () => {
    expect(through("{'name': 'search_hotels', 'parameters': {'city': 'siem-reap'}}")).toBe('');
  });

  it('suppresses a leaked call that names arguments instead of parameters', () => {
    expect(through('{"function": "compose_itinerary", "arguments": {"guests": 2}}')).toBe('');
  });

  it('suppresses a truncated leaked call left dangling at the end of a turn', () => {
    expect(through('{"name": "compose_itin')).toBe('');
  });

  it('drops orphaned punctuation before the first real word', () => {
    // Observed live: the turn opened with ";" — the tail of a suppressed
    // structure. A message must not start with that.
    expect(through(';The search found two hotels.')).toBe('The search found two hotels.');
  });

  it('drops a turn that is nothing but punctuation', () => {
    expect(through(';')).toBe('');
  });

  it('keeps prose that merely happens to contain braces later on', () => {
    const text = 'Use the code {SUMMER} at checkout for a discount.';

    expect(through(text)).toBe(text);
  });

  it('releases a long structural-looking passage rather than swallowing it', () => {
    // Not a tool call, just unusual text. Better shown than silently dropped.
    const text = `{ ${'a lot of harmless text '.repeat(15)}}`;

    expect(through(text)).toBe(text);
  });

  it('holds nothing back once it has decided the text is prose', () => {
    const gate = new ProseGate();
    gate.push('Hello. ');

    expect(gate.push('{"name": "not-a-call"}')).toBe('{"name": "not-a-call"}');
    expect(gate.flush()).toBeNull();
  });

  it('ignores leading whitespace when deciding', () => {
    expect(through('   \n {"name": "search_hotels", "parameters": {}}')).toBe('');
  });
});
