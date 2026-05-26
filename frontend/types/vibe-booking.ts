import type { ContentPayload } from '@/schemas/vibe-booking'

export type AgentState =
  | 'DISCOVERY'
  | 'SUGGESTION'
  | 'EXPLORATION'
  | 'CUSTOMIZATION'
  | 'BOOKING'
  | 'PAYMENT'
  | 'POST_BOOKING'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  timestamp: number
  contentPayload?: ContentPayload
  agentState?: AgentState
}

export interface ContentItem {
  id: string
  type: ContentPayload['type']
  payload: ContentPayload
  timestamp: number
}

export interface WsAuthMessage {
  type: 'auth'
  user_id: string
  preferred_language: 'EN' | 'ZH' | 'KH'
  session_id?: string
}

export interface WsUserMessage {
  type: 'user_message'
  content: string
}

export interface WsUserAction {
  type: 'user_action'
  action_type: string
  item_id?: string
  payload?: Record<string, unknown>
}

export interface WsPingMessage {
  type: 'ping'
}

export interface WsPaymentCompletedMessage {
  type: 'payment_completed'
  booking_id?: string
}

export type WsOutbound =
  | WsAuthMessage
  | WsUserMessage
  | WsUserAction
  | WsPingMessage
  | WsPaymentCompletedMessage
