/**
 * Keeps machinery out of the chat window.
 *
 * Small models sometimes write a tool call into the *content* channel instead of
 * the tool-call channel. Observed live from llama-3.1-8b:
 *
 *   {"name": "search_places", "parameters": {"city": "siem-reap"}}
 *
 * Streamed straight through, that lands in the traveller's chat as raw JSON.
 * This gate holds back text that starts like a JSON object until it can tell
 * whether it is prose or a leaked call, and drops it if it is the latter.
 *
 * Prose never begins with `{`, so the cost is nil in the normal case: the very
 * first delta decides, and everything after it flows straight through.
 */
export class ProseGate {
  private buffer = '';
  private decided: 'prose' | 'suppress' | null = null;
  private seen = 0;

  /** How much text to inspect before giving up and treating it as prose. */
  private static readonly INSPECT_LIMIT = 200;

  /** Returns the text safe to show, or null to hold/discard it. */
  push(delta: string): string | null {
    if (this.decided === 'prose') {
      return delta;
    }
    if (this.decided === 'suppress') {
      return null;
    }

    this.buffer += delta;
    this.seen += delta.length;
    const trimmed = this.buffer.trimStart();

    if (trimmed === '') {
      return null;
    }

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      // A turn sometimes opens with orphaned punctuation — the tail of a
      // suppressed structure, or just noise. Wait for a real word and start
      // there, so the traveller never sees a message beginning with ";".
      const firstWord = this.buffer.search(/[\p{L}\p{N}]/u);
      if (firstWord === -1) {
        return this.seen >= ProseGate.INSPECT_LIMIT ? this.release() : null;
      }
      this.decided = 'prose';
      const out = this.buffer.slice(firstWord);
      this.buffer = '';
      return out;
    }

    // Looks structural. Decide once there is enough to tell.
    if (LEAKED_CALL.test(trimmed)) {
      this.decided = 'suppress';
      this.buffer = '';
      return null;
    }

    if (this.seen >= ProseGate.INSPECT_LIMIT) {
      // Long enough without looking like a call — let it through rather than
      // silently swallowing something the traveller was meant to read.
      this.decided = 'prose';
      const out = this.buffer;
      this.buffer = '';
      return out;
    }

    return null;
  }

  private release(): string {
    this.decided = 'prose';
    const out = this.buffer;
    this.buffer = '';
    return out;
  }

  /** Anything still held when the turn ends. */
  flush(): string | null {
    if (this.decided === 'suppress') {
      return null;
    }
    const out = this.buffer;
    this.buffer = '';
    // An unresolved fragment that opened like JSON is almost certainly a
    // truncated leaked call, and one with no word in it says nothing at all.
    if (this.decided === null) {
      if (out.trimStart().startsWith('{') || !/[\p{L}\p{N}]/u.test(out)) {
        return null;
      }
    }
    return out || null;
  }
}

/** A JSON object naming a function and its arguments — i.e. a leaked tool call. */
const LEAKED_CALL = /^[[{]\s*(?:"|')?(name|function|tool_name|parameters|arguments)(?:"|')?\s*:/i;
