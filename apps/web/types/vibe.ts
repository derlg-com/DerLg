/** Mirrors apps/api/src/modules/vibe/interfaces/vibe.interface.ts. */

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

/** A panel shown on the right-hand screen. */
export interface VibePanel {
  id: string;
  stage: VibeContentStage;
  payload: unknown;
}

/** A turn in the chat column. */
export interface VibeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Set while the assistant's text is still arriving. */
  streaming?: boolean;
  panel?: VibePanel;
}

export interface ToolProgress {
  name: string;
  status: 'running' | 'done' | 'failed';
  label: string;
  durationMs?: number;
}

export interface VibeConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
}

export interface VibeTranscript {
  id: string;
  title: string | null;
  aiAvailable: boolean;
  messages: {
    role: 'USER' | 'ASSISTANT';
    content: string;
    contentPayload: { stage: VibeContentStage; payload: unknown } | null;
    createdAt: string;
  }[];
}
