'use client'

import { useRef, useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'

interface Props {
  onSend: (text: string) => void
  onAction: (actionType: string, itemId?: string, payload?: Record<string, unknown>) => void
}

export default function ChatPanel({ onSend }: Props) {
  const { messages, isTyping, connectionStatus } = useChatStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || connectionStatus !== 'connected') return
    onSend(text)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="font-semibold text-sm">DerLg AI Concierge</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {connectionStatus}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-3 py-2 text-sm text-muted-foreground animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about your dream trip…"
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          disabled={connectionStatus !== 'connected'}
        />
        <button
          type="submit"
          disabled={!input.trim() || connectionStatus !== 'connected'}
          className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
