'use client'

import { useRef, useEffect, useState } from 'react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { useTranslations } from '@/lib/i18n'
import MessageActions from '@/components/vibe-booking/MessageActions'
import ChatFeedback from '@/components/vibe-booking/ChatFeedback'
import SuggestionChips from '@/components/vibe-booking/SuggestionChips'
import { MarkdownText } from '@/components/shared/MarkdownText'
import { PureMultimodalInput } from '@/components/ui/multimodal-ai-chat-input'

interface Props {
  onSend: (text: string) => void
  onFeedback: (messageId: string, helpful: boolean) => void
}

export default function ChatPanel({ onSend, onFeedback }: Props) {
  const { messages, isTyping, toolStatus, reasoningText, connectionStatus, suggestions, welcomePrompts } =
    useVibeBookingStore()
  const [showThinking, setShowThinking] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const t = useTranslations()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, reasoningText, suggestions])

  const retryLast = () => {
    if (connectionStatus !== 'connected') return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser?.content) onSend(lastUser.content)
  }

  const hasUserMessage = messages.some((m) => m.role === 'user')
  // Welcome prompts only before the first user turn; follow-up chips after an
  // answer (and not while a new answer is streaming).
  const showWelcomePrompts = !hasUserMessage && welcomePrompts.length > 0
  const showSuggestions = hasUserMessage && !isTyping && suggestions.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="font-display font-semibold text-sm">{t('chat.title')}</span>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {t(`common.${connectionStatus}`)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, idx) => {
          const precededByUser = messages.slice(0, idx).some((m) => m.role === 'user')
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'user' && msg.context && (
                <span className="text-[11px] text-muted-foreground px-1">
                  {t('chat.askedWhileViewing', { page: msg.context })}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.type === 'error'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-foreground'
                }`}
              >
                <MarkdownText text={msg.content} />
              </div>
              {msg.role === 'assistant' && msg.type !== 'error' && msg.content && (
                <>
                  <MessageActions content={msg.content} onRetry={retryLast} />
                  {precededByUser && <ChatFeedback messageId={msg.id} onFeedback={onFeedback} />}
                </>
              )}
            </div>
          )
        })}
        {reasoningText && (
          <div className="flex justify-start">
            <div className="max-w-[90%] w-full rounded-2xl border border-border bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => setShowThinking((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-muted-foreground font-medium"
                aria-expanded={showThinking}
              >
                <span className={isTyping ? 'animate-pulse' : ''}>💭</span>
                {t('common.thinkingProcess')}
                <span className="ml-auto">{showThinking ? '▾' : '▸'}</span>
              </button>
              {showThinking && (
                <pre className="px-3 pb-2 whitespace-pre-wrap break-words font-sans text-muted-foreground/90 max-h-48 overflow-y-auto">
                  {reasoningText}
                </pre>
              )}
            </div>
          </div>
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-3 py-2 text-sm text-muted-foreground animate-pulse">
              {toolStatus ? t(`tools.${toolStatus}`, undefined, 'tools.running') : t('common.thinking')}
            </div>
          </div>
        )}
        {showWelcomePrompts && (
          <SuggestionChips
            items={welcomePrompts}
            onSelect={onSend}
            title={t('chat.welcomeTitle')}
          />
        )}
        {showSuggestions && (
          <SuggestionChips
            items={suggestions}
            onSelect={onSend}
            ariaLabel={t('chat.suggestionsLabel')}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border">
        <PureMultimodalInput
          messages={messages}
          onSendMessage={({ input }) => onSend(input)}
          onStopGenerating={() => {}}
          isGenerating={isTyping}
          canSend={connectionStatus === 'connected'}
          placeholder={t('chat.placeholder')}
        />
      </div>
    </div>
  )
}
