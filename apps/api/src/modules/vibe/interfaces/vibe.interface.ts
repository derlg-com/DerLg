/**
 * The wire contract between the agent loop and the browser.
 *
 * Every event is written to the SSE stream as `event: <type>` + `data: <json>`.
 * Task 17's renderers switch on `VibeContentEvent.stage`.
 */

/** Structured panels the concierge can push to the right-hand screen. */
export type VibeContentStage =
  | 'greeting'
  | 'packages'
  | 'places'
  | 'hotels'
  | 'transport'
  | 'guides'
  | 'availability'
  | 'itinerary'
  | 'booking'
  | 'text_summary';

export interface VibeTokenEvent {
  type: 'token';
  delta: string;
}

export interface VibeToolStatusEvent {
  type: 'tool_status';
  name: string;
  status: 'running' | 'done' | 'failed';
  /** Human sentence for the UI, e.g. "Looking up hotels in Siem Reap…". */
  label: string;
  durationMs?: number;
}

export interface VibeContentEvent {
  type: 'content';
  stage: VibeContentStage;
  payload: unknown;
}

export interface VibeDoneEvent {
  type: 'done';
  conversationId: string;
  messageId: string | null;
  /** How many model round-trips the answer took. */
  iterations: number;
}

export interface VibeErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type VibeEvent =
  | VibeTokenEvent
  | VibeToolStatusEvent
  | VibeContentEvent
  | VibeDoneEvent
  | VibeErrorEvent;

/** A turn as held in the Redis session. */
export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
  toolCallId?: string;
  name?: string;
  /** Structured panel that accompanied an assistant turn, replayed on reload. */
  content_stage?: { stage: VibeContentStage; payload: unknown };
  createdAt: string;
}

/** A catalogue row the traveller has already been shown. */
export interface ShownItem {
  type: string;
  refId: string;
  name: string;
  priceUsd?: number;
}

export interface ConversationSession {
  conversationId: string;
  userId: string;
  title: string | null;
  messages: SessionMessage[];
  /** Draft the conversation is currently shaping, set by Task 16's composer. */
  draftId?: string;
  /** Catalogue ids the tools have returned, so the composer can check provenance. */
  knownRefIds?: string[];
  /**
   * Everything the tools have surfaced in this conversation.
   *
   * Only one content panel survives per turn, so panels alone are a lossy
   * memory: a temple search followed by a hotel search left the temple ids
   * unrecoverable, and the model then wrote nonsense into refId. This is the
   * authoritative recall list.
   */
  shownItems?: ShownItem[];
  updatedAt: string;
}

/** Session lives in Redis for a week; Postgres keeps the durable transcript. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Guard against a model that keeps calling tools forever. */
export const MAX_AGENT_ITERATIONS = 5;

/** Comment frames keep proxies from closing an idle stream. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** How much history is replayed to the model. Older turns stay in Postgres. */
export const MAX_HISTORY_MESSAGES = 24;

export function sessionKey(userId: string, conversationId: string): string {
  return `ai:conv:${userId}:${conversationId}`;
}
