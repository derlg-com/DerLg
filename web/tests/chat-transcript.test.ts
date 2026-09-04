import { describe, expect, it } from 'vitest'

import { parseInboundFrame, type InboundFrame } from '@/lib/vibe/protocol'
import {
  initialTranscript,
  transcriptReducer,
  type AgentTurn,
  type NoticeTurn,
  type TranscriptState,
} from '@/lib/vibe/transcript'

/** Parses through the real schema so tests cannot assert on shapes the agent never sends. */
function frame(value: Record<string, unknown>): InboundFrame {
  const parsed = parseInboundFrame(JSON.stringify(value))
  if (!parsed) throw new Error(`frame rejected by schema: ${JSON.stringify(value)}`)
  return parsed
}

function reduce(actions: Parameters<typeof transcriptReducer>[1][]): TranscriptState {
  return actions.reduce(transcriptReducer, initialTranscript)
}

function frames(...values: Record<string, unknown>[]) {
  return values.map((value) => ({ type: 'frame', frame: frame(value) }) as const)
}

const HELLO = {
  type: 'conversation_started',
  text: 'Welcome to DerLg!',
  session_id: '11111111-1111-4111-8111-111111111111',
  suggested_prompts: ['Plan a 3-day Siem Reap temple tour', 'Best time to visit Angkor Wat'],
}

describe('transcript: conversation start', () => {
  it('records the greeting and the suggested prompts', () => {
    const state = reduce(frames(HELLO))

    expect(state.turns).toHaveLength(1)
    expect(state.turns[0]).toMatchObject({ kind: 'agent', text: 'Welcome to DerLg!' })
    expect(state.suggestedPrompts).toHaveLength(2)
    expect(state.sessionId).toBe(HELLO.session_id)
  })

  it('does not duplicate the greeting when a reconnect replays it', () => {
    const state = reduce([
      ...frames(HELLO),
      { type: 'send', text: 'Hi' },
      // The agent greets again on the new connection.
      ...frames(HELLO),
    ])

    const greetings = state.turns.filter(
      (turn) => turn.kind === 'agent' && turn.text === 'Welcome to DerLg!',
    )
    expect(greetings).toHaveLength(1)
  })

  it('treats a resumed conversation the same way', () => {
    const state = reduce(
      frames({ ...HELLO, type: 'conversation_resumed', text: 'Welcome back!' }),
    )
    expect(state.turns[0]).toMatchObject({ text: 'Welcome back!' })
  })
})

describe('transcript: a full agent turn', () => {
  /** The exact frame order the agent produces, per its websocket.py. */
  const turn = [
    { type: 'typing_start' },
    { type: 'agent_tool_status', tool: 'search_trips', status: 'running' },
    { type: 'agent_reasoning_chunk', content: 'The user wants temples. ' },
    { type: 'agent_stream_chunk', content: 'I found ' },
    { type: 'agent_stream_chunk', content: 'three trips.' },
    { type: 'agent_tool_status', tool: 'search_trips', status: 'completed' },
    { type: 'typing_end' },
    {
      type: 'agent_message',
      text: 'I found three trips.',
      content_payloads: [{ type: 'trip_cards', data: { trips: [] } }],
      suggestions: ['Show hotels nearby'],
    },
  ]

  it('accumulates streamed text while the reply is in flight', () => {
    const state = reduce(frames(...turn.slice(0, 4)))
    expect(state.streaming).toBe('I found ')
    expect(state.typing).toBe(true)
  })

  it('accumulates reasoning separately from the answer', () => {
    const state = reduce(frames(...turn.slice(0, 3)))
    expect(state.reasoning).toBe('The user wants temples. ')
    expect(state.streaming).toBe('')
  })

  it('keeps one chip per tool as its status changes', () => {
    const state = reduce(frames(...turn.slice(0, 6)))
    expect(state.tools).toEqual([{ name: 'search_trips', status: 'completed' }])
  })

  it('commits the final message and clears the in-flight buffers', () => {
    const state = reduce(frames(...turn))

    expect(state.streaming).toBe('')
    expect(state.tools).toEqual([])
    expect(state.typing).toBe(false)

    const committed = state.turns.at(-1) as AgentTurn
    expect(committed.kind).toBe('agent')
    // The final text is authoritative; the streamed preview must not be appended.
    expect(committed.text).toBe('I found three trips.')
    expect(committed.blocks).toHaveLength(1)
    expect(committed.suggestions).toEqual(['Show hotels nearby'])
  })

  it('retains the reasoning on the committed message so it stays inspectable', () => {
    const state = reduce(frames(...turn))
    const committed = state.turns.at(-1) as AgentTurn
    expect(committed.reasoning).toBe('The user wants temples. ')
  })

  it('accepts the singular content_payload from older agent builds', () => {
    const state = reduce(
      frames({
        type: 'agent_message',
        text: 'One result',
        content_payload: { type: 'text_summary', data: { text: 'hi' } },
      }),
    )
    const committed = state.turns.at(-1) as AgentTurn
    expect(committed.blocks).toHaveLength(1)
  })
})

describe('transcript: user messages', () => {
  it('echoes the user message immediately', () => {
    const state = reduce([{ type: 'send', text: 'Find me a temple tour' }])
    expect(state.turns[0]).toMatchObject({ kind: 'user', text: 'Find me a temple tour' })
  })

  it('records the page the question was asked from', () => {
    const state = reduce([{ type: 'send', text: 'Is this good?', context: 'Angkor Wat trip' }])
    expect(state.turns[0]).toMatchObject({ context: 'Angkor Wat trip' })
  })

  it('clears the opening prompts once the user has asked something', () => {
    const state = reduce([...frames(HELLO), { type: 'send', text: 'Hi' }])
    expect(state.suggestedPrompts).toEqual([])
  })

  it('gives every turn a unique id', () => {
    const state = reduce([
      { type: 'send', text: 'one' },
      { type: 'send', text: 'two' },
      ...frames({ type: 'agent_message', text: 'reply' }),
    ])
    const ids = state.turns.map((turn) => turn.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('transcript: gates and errors', () => {
  it('records a login gate without ending the conversation', () => {
    const state = reduce(
      frames({ type: 'requires_login', message: 'Please sign in to book.' }),
    )
    expect(state.turns[0]).toMatchObject({ kind: 'notice', tone: 'login' })
    expect(state.typing).toBe(false)
  })

  it('records a payment gate with its booking and amount', () => {
    const state = reduce(
      frames({ type: 'requires_payment', booking_id: 'bk_1', amount_usd: 189 }),
    )
    expect(state.turns[0]).toMatchObject({
      kind: 'notice',
      tone: 'payment',
      bookingId: 'bk_1',
      amountUsd: 189,
    })
  })

  it('surfaces an error and abandons the in-flight reply', () => {
    const state = reduce(
      frames(
        { type: 'typing_start' },
        { type: 'agent_stream_chunk', content: 'partial' },
        { type: 'error', message: 'Something went wrong. Please try again.' },
      ),
    )

    // A half-streamed answer left on screen next to an error reads as truth.
    expect(state.streaming).toBe('')
    expect(state.typing).toBe(false)
    expect(state.turns.at(-1)).toMatchObject({ kind: 'notice', tone: 'error' })
  })

  it('ignores pong frames', () => {
    const before = reduce(frames(HELLO))
    const after = transcriptReducer(before, { type: 'frame', frame: frame({ type: 'pong' }) })
    expect(after).toBe(before)
  })
})

describe('transcript: feedback and reset', () => {
  it('marks feedback on the addressed message only', () => {
    const state = reduce([
      ...frames({ type: 'agent_message', text: 'first' }),
      ...frames({ type: 'agent_message', text: 'second' }),
    ])
    const first = state.turns[0] as AgentTurn
    const updated = transcriptReducer(state, { type: 'feedback', id: first.id, helpful: true })

    expect((updated.turns[0] as AgentTurn).feedback).toBe('up')
    expect((updated.turns[1] as AgentTurn).feedback).toBeUndefined()
  })

  it('reset clears the transcript for a new conversation', () => {
    const state = reduce([...frames(HELLO), { type: 'send', text: 'Hi' }])
    const cleared = transcriptReducer(state, { type: 'reset' })

    expect(cleared.turns).toEqual([])
    expect(cleared.sessionId).toBeNull()
    expect(cleared.suggestedPrompts).toEqual([])
  })
})

describe('transcript: notice typing', () => {
  it('exposes the notice tone as a discriminated field', () => {
    const state = reduce(frames({ type: 'requires_login' }))
    const notice = state.turns[0] as NoticeTurn
    expect(notice.kind).toBe('notice')
    expect(['error', 'login', 'payment']).toContain(notice.tone)
  })
})


describe('transcript: server-minted message ids', () => {
  /*
   * Feedback is addressed by the turn id. The agent can only resolve that id back
   * to a stored row if it minted the id itself, so when `message_id` is present it
   * must win over the locally generated `a{n}`.
   *
   * The fallback still matters: older agent builds send no id, and a vote against
   * a client-invented id round-trips but cannot be persisted — which is better
   * than the UI breaking.
   */
  it('uses the agent id as the turn id when the frame carries one', () => {
    const state = reduce(
      frames(HELLO, {
        type: 'agent_message',
        message_id: 'srv-abc-123',
        text: 'Here are 3 temple tours.',
      }),
    )

    const reply = state.turns.at(-1) as AgentTurn
    expect(reply.id).toBe('srv-abc-123')
  })

  it('falls back to a locally minted id when the frame omits one', () => {
    const state = reduce(
      frames(HELLO, { type: 'agent_message', text: 'Here are 3 temple tours.' }),
    )

    const reply = state.turns.at(-1) as AgentTurn
    // Deterministic and monotonic, so older agents keep working.
    expect(reply.id).toMatch(/^a\d+$/)
  })

  it('keeps ids unique across a mix of server-minted and fallback replies', () => {
    const state = reduce(
      frames(
        HELLO,
        { type: 'agent_message', message_id: 'srv-1', text: 'first' },
        { type: 'agent_message', text: 'second' },
        { type: 'agent_message', message_id: 'srv-2', text: 'third' },
      ),
    )

    const ids = state.turns.map((turn) => turn.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('advances nextId even when the server id is used, so later fallbacks do not collide', () => {
    const withServerId = reduce(
      frames(HELLO, { type: 'agent_message', message_id: 'srv-1', text: 'first' }),
    )
    const then = transcriptReducer(withServerId, {
      type: 'frame',
      frame: frame({ type: 'agent_message', text: 'second' }),
    })

    const ids = then.turns.map((turn) => turn.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('marks feedback against a server-minted id', () => {
    const state = reduce(
      frames(HELLO, {
        type: 'agent_message',
        message_id: 'srv-abc-123',
        text: 'Here are 3 temple tours.',
      }),
    )

    const updated = transcriptReducer(state, {
      type: 'feedback',
      id: 'srv-abc-123',
      helpful: false,
    })

    expect((updated.turns.at(-1) as AgentTurn).feedback).toBe('down')
  })

  it('accepts a frame with message_id through the schema', () => {
    // The schema must not reject the new field, or the whole reply is dropped.
    const parsed = parseInboundFrame(
      JSON.stringify({ type: 'agent_message', message_id: 'srv-1', text: 'hi' }),
    )

    expect(parsed).not.toBeNull()
  })
})
