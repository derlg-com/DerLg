'use client'

import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { useTranslations } from '@/lib/i18n'

interface Props {
  messageId: string
  onFeedback: (messageId: string, helpful: boolean) => void
}

/**
 * "Was this helpful?" control shown under an assistant answer. The vote is
 * persisted per message in the store, so after voting (or on refresh) it shows
 * a thank-you instead of the buttons.
 */
export default function ChatFeedback({ messageId, onFeedback }: Props) {
  const vote = useVibeBookingStore((s) => s.messageFeedback[messageId])
  const t = useTranslations()

  if (vote) {
    return (
      <p className="px-1 pt-0.5 text-[11px] text-muted-foreground">{t('chat.feedbackThanks')}</p>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-1 pt-0.5">
      <span className="text-[11px] text-muted-foreground">{t('chat.feedbackPrompt')}</span>
      <button
        type="button"
        onClick={() => onFeedback(messageId, true)}
        aria-label={t('chat.feedbackYes')}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ThumbsUp size={13} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(messageId, false)}
        aria-label={t('chat.feedbackNo')}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ThumbsDown size={13} aria-hidden />
      </button>
    </div>
  )
}
