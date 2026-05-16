import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ConnectionStatus, AgentState } from '@/types/vibe-booking'

interface ChatState {
  messages: ChatMessage[]
  isTyping: boolean
  connectionStatus: ConnectionStatus
  agentState: AgentState
  sessionId: string | null
  addMessage: (msg: ChatMessage) => void
  setTyping: (v: boolean) => void
  setConnectionStatus: (s: ConnectionStatus) => void
  setAgentState: (s: AgentState) => void
  setSessionId: (id: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isTyping: false,
      connectionStatus: 'disconnected',
      agentState: 'DISCOVERY',
      sessionId: null,
      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages.slice(-49), msg] })),
      setTyping: (v) => set({ isTyping: v }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setAgentState: (agentState) => set({ agentState }),
      setSessionId: (sessionId) => set({ sessionId }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'derlg:chat',
      partialize: (s) => ({ messages: s.messages.slice(-50), sessionId: s.sessionId }),
    }
  )
)
