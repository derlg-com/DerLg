import { z } from 'zod'

/**
 * Wire protocol for the Vibe Booking agent WebSocket.
 *
 * Every inbound frame is validated before it reaches the UI. The agent is a
 * separate service, so its payloads are untrusted input: an unexpected shape must
 * be dropped rather than crashing the chat mid-booking.
 *
 * The frame list below was verified against the running agent, not inferred.
 */

/* ------------------------------------------------------------- outbound */

/**
 * The handshake, which must be sent within 10 seconds of the socket opening.
 *
 * `token` is optional: without it the agent runs a guest session and keeps
 * booking locked. With a token whose signature matches the backend's
 * JWT_ACCESS_SECRET, the agent re-binds the session to the real user id.
 */
export interface AuthFrame {
  type: 'auth'
  user_id: string
  session_id?: string
  token?: string
  preferred_language: 'EN' | 'ZH' | 'KH'
}

export interface UserMessageFrame {
  type: 'user_message'
  content: string
  /** Page the question was asked from; the agent truncates to 80 chars. */
  context?: string
}

export interface UserActionFrame {
  type: 'user_action'
  action_type: string
  payload?: Record<string, unknown>
}

export interface PaymentCompletedFrame {
  type: 'payment_completed'
  booking_id: string
}

export interface FeedbackFrame {
  type: 'feedback'
  message_id: string
  helpful: boolean
}

export interface PingFrame {
  type: 'ping'
}

export type OutboundFrame =
  | AuthFrame
  | UserMessageFrame
  | UserActionFrame
  | PaymentCompletedFrame
  | FeedbackFrame
  | PingFrame

/* -------------------------------------------------------------- inbound */

/**
 * Content blocks are validated by schemas/vibe-payloads.ts. Here they stay loose
 * so an unrecognised block type still arrives and can be skipped by the renderer
 * registry, rather than invalidating the whole message.
 */
const ContentBlockSchema = z.looseObject({
  type: z.string(),
  data: z.unknown().optional(),
  actions: z.array(z.unknown()).optional(),
  metadata: z.unknown().optional(),
})

const ConversationStartedSchema = z.looseObject({
  type: z.literal('conversation_started'),
  text: z.string(),
  session_id: z.string(),
  suggested_prompts: z.array(z.string()).optional(),
})

const ConversationResumedSchema = z.looseObject({
  type: z.literal('conversation_resumed'),
  text: z.string(),
  session_id: z.string(),
  suggested_prompts: z.array(z.string()).optional(),
})

const TypingStartSchema = z.looseObject({ type: z.literal('typing_start') })
const TypingEndSchema = z.looseObject({ type: z.literal('typing_end') })

const StreamChunkSchema = z.looseObject({
  type: z.literal('agent_stream_chunk'),
  // The agent labels the text field differently across chunk types, so accept
  // either and normalise in the client.
  content: z.string().optional(),
  text: z.string().optional(),
  delta: z.string().optional(),
})

const ReasoningChunkSchema = z.looseObject({
  type: z.literal('agent_reasoning_chunk'),
  content: z.string().optional(),
  text: z.string().optional(),
  delta: z.string().optional(),
})

const ToolStatusSchema = z.looseObject({
  type: z.literal('agent_tool_status'),
  tool: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
})

const AgentMessageSchema = z.looseObject({
  type: z.literal('agent_message'),
  text: z.string(),
  /** Singular form kept for backward compatibility with older agent builds. */
  content_payload: ContentBlockSchema.optional(),
  content_payloads: z.array(ContentBlockSchema).optional(),
  suggestions: z.array(z.string()).optional(),
})

const RequiresLoginSchema = z.looseObject({
  type: z.literal('requires_login'),
  message: z.string().optional(),
})

/** `requires_payment` spreads its payload onto the frame itself. */
const RequiresPaymentSchema = z.looseObject({
  type: z.literal('requires_payment'),
  booking_id: z.string().optional(),
  amount_usd: z.number().optional(),
})

const PongSchema = z.looseObject({
  type: z.literal('pong'),
  timestamp: z.string().optional(),
})

const ErrorSchema = z.looseObject({
  type: z.literal('error'),
  message: z.string(),
})

export const InboundFrameSchema = z.discriminatedUnion('type', [
  ConversationStartedSchema,
  ConversationResumedSchema,
  TypingStartSchema,
  TypingEndSchema,
  StreamChunkSchema,
  ReasoningChunkSchema,
  ToolStatusSchema,
  AgentMessageSchema,
  RequiresLoginSchema,
  RequiresPaymentSchema,
  PongSchema,
  ErrorSchema,
])

export type InboundFrame = z.infer<typeof InboundFrameSchema>
export type ContentBlock = z.infer<typeof ContentBlockSchema>

/** Parses a raw frame, returning null for anything unrecognised. */
export function parseInboundFrame(raw: string): InboundFrame | null {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }

  const result = InboundFrameSchema.safeParse(json)
  return result.success ? result.data : null
}

/** Normalises the several field names the agent uses for streamed text. */
export function chunkText(frame: InboundFrame): string {
  if (frame.type !== 'agent_stream_chunk' && frame.type !== 'agent_reasoning_chunk') return ''
  return frame.content ?? frame.text ?? frame.delta ?? ''
}

/* --------------------------------------------------------- close codes */

/**
 * Close codes the agent uses, each needing a different response from the UI.
 * Reconnecting on a rejected origin or a bad token would loop forever.
 */
export const CloseCode = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  /** Policy violation — the agent uses this for an invalid JWT. */
  INVALID_TOKEN: 1008,
  /** The handshake frame was missing, malformed, or too late. */
  HANDSHAKE_FAILED: 4000,
  HANDSHAKE_REJECTED: 4001,
  /** Origin is not in the agent's ALLOWED_WS_ORIGINS allowlist. */
  ORIGIN_REJECTED: 4403,
} as const

/** True when reconnecting could plausibly succeed. */
export function isRetryableClose(code: number): boolean {
  return (
    code !== CloseCode.NORMAL &&
    code !== CloseCode.INVALID_TOKEN &&
    code !== CloseCode.ORIGIN_REJECTED &&
    code !== CloseCode.HANDSHAKE_REJECTED
  )
}
