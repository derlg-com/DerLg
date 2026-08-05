/**
 * Transcript state machine for the concierge conversation.
 *
 * Kept as a pure reducer with no React and no socket dependency, because the
 * interesting behaviour is the FRAME SEQUENCE (stream chunks arriving before the
 * final message, tool statuses overlapping, a payment gate landing just before
 * the reply) and that is only testable in isolation.
 *
 * Frame order confirmed against the agent's websocket.py:
 *   typing_start -> chunks/reasoning/tool_status* -> typing_end
 *   -> [requires_payment] -> agent_message
 */
import { chunkText, type ContentBlock, type InboundFrame } from './protocol'

export interface UserTurn {
  kind: 'user'
  id: string
  text: string
  /** Page the question was asked from, shown as provenance. */
  context?: string
}

export interface AgentTurn {
  kind: 'agent'
  id: string
  text: string
  blocks: ContentBlock[]
  suggestions: string[]
  /** Retained after commit so the reply stays inspectable. */
  reasoning?: string
  feedback?: 'up' | 'down'
}

export interface NoticeTurn {
  kind: 'notice'
  id: string
  tone: 'error' | 'login' | 'payment'
  message?: string
  bookingId?: string
  amountUsd?: number
}

export type Turn = UserTurn | AgentTurn | NoticeTurn

export interface ToolStatus {
  name: string
  status: string
}

export interface TranscriptState {
  turns: Turn[]
  /** Text accumulated from stream chunks for the reply in flight. */
  streaming: string
  /** Reasoning accumulated for the reply in flight. */
  reasoning: string
  tools: ToolStatus[]
  typing: boolean
  /** Prompts offered by the agent at the start of a conversation. */
  suggestedPrompts: string[]
  sessionId: string | null
  /** Monotonic, so ids are stable and tests are deterministic. */
  nextId: number
}

export const initialTranscript: TranscriptState = {
  turns: [],
  streaming: '',
  reasoning: '',
  tools: [],
  typing: false,
  suggestedPrompts: [],
  sessionId: null,
  nextId: 1,
}

export type TranscriptAction =
  | { type: 'frame'; frame: InboundFrame }
  | { type: 'send'; text: string; context?: string }
  | { type: 'feedback'; id: string; helpful: boolean }
  | { type: 'reset' }

export function transcriptReducer(
  state: TranscriptState,
  action: TranscriptAction,
): TranscriptState {
  switch (action.type) {
    case 'reset':
      return { ...initialTranscript }

    case 'send': {
      const id = `u${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        // Suggested prompts are a first-turn affordance; once the user has asked
        // something they are stale.
        suggestedPrompts: [],
        turns: [
          ...state.turns,
          {
            kind: 'user',
            id,
            text: action.text,
            ...(action.context ? { context: action.context } : {}),
          },
        ],
      }
    }

    case 'feedback':
      return {
        ...state,
        turns: state.turns.map((turn) =>
          turn.kind === 'agent' && turn.id === action.id
            ? { ...turn, feedback: action.helpful ? 'up' : 'down' }
            : turn,
        ),
      }

    case 'frame':
      return applyFrame(state, action.frame)
  }
}

function applyFrame(state: TranscriptState, frame: InboundFrame): TranscriptState {
  switch (frame.type) {
    case 'conversation_started':
    case 'conversation_resumed': {
      const id = `a${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        sessionId: frame.session_id,
        suggestedPrompts: frame.suggested_prompts ?? [],
        // A reconnect replays the greeting; don't stack duplicates on top of an
        // existing transcript.
        turns: state.turns.length
          ? state.turns
          : [{ kind: 'agent', id, text: frame.text, blocks: [], suggestions: [] }],
      }
    }

    case 'typing_start':
      return { ...state, typing: true }

    case 'typing_end':
      return { ...state, typing: false }

    case 'agent_stream_chunk':
      return { ...state, streaming: state.streaming + chunkText(frame) }

    case 'agent_reasoning_chunk':
      return { ...state, reasoning: state.reasoning + chunkText(frame) }

    case 'agent_tool_status': {
      const name = frame.tool ?? frame.name ?? 'unknown'
      const status = frame.status ?? 'running'
      const existing = state.tools.findIndex((tool) => tool.name === name)

      // Upsert: a tool reports running then completed, and should occupy one chip.
      const tools =
        existing === -1
          ? [...state.tools, { name, status }]
          : state.tools.map((tool, index) => (index === existing ? { name, status } : tool))

      return { ...state, tools }
    }

    case 'agent_message': {
      const id = `a${state.nextId}`
      /*
       * The final `text` is authoritative — the streamed chunks are a preview of
       * the same reply, so appending both would duplicate it.
       */
      const blocks =
        frame.content_payloads ?? (frame.content_payload ? [frame.content_payload] : [])

      return {
        ...state,
        nextId: state.nextId + 1,
        streaming: '',
        reasoning: '',
        tools: [],
        typing: false,
        suggestedPrompts: [],
        turns: [
          ...state.turns,
          {
            kind: 'agent',
            id,
            text: frame.text,
            blocks,
            suggestions: frame.suggestions ?? [],
            ...(state.reasoning ? { reasoning: state.reasoning } : {}),
          },
        ],
      }
    }

    case 'requires_login': {
      const id = `n${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        typing: false,
        turns: [
          ...state.turns,
          { kind: 'notice', id, tone: 'login', ...(frame.message ? { message: frame.message } : {}) },
        ],
      }
    }

    case 'requires_payment': {
      const id = `n${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        turns: [
          ...state.turns,
          {
            kind: 'notice',
            id,
            tone: 'payment',
            ...(frame.booking_id ? { bookingId: frame.booking_id } : {}),
            ...(frame.amount_usd !== undefined ? { amountUsd: frame.amount_usd } : {}),
          },
        ],
      }
    }

    case 'error': {
      const id = `n${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        streaming: '',
        reasoning: '',
        tools: [],
        typing: false,
        turns: [...state.turns, { kind: 'notice', id, tone: 'error', message: frame.message }],
      }
    }

    case 'pong':
      // Liveness only; the socket handles it.
      return state
  }
}
