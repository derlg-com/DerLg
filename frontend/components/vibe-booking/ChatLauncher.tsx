'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import { useLanguageStore, languageStoreToWsLang, useTranslations } from '@/lib/i18n'
import { getStoredUserId } from '@/lib/auth'
import { pageContextLabel } from '@/lib/vibe-content'
import { useWebSocket } from '@/hooks/useWebSocket'
import ChatPanel from '@/components/vibe-booking/ChatPanel'
import ContentStage from '@/components/vibe-booking/ContentStage'
import LoginModal from '@/components/vibe-booking/LoginModal'

/**
 * The chat dock body — mounted only while the launcher is open so the WebSocket
 * connects lazily (and disconnects on close). Reuses the same ContentStage +
 * ChatPanel + store as the full /vibe-booking page, so the conversation is
 * shared across both surfaces. Every message carries the page context.
 */
function ChatDockBody({ pageContext, onClose }: { pageContext: string; onClose: () => void }) {
  const locale = useLanguageStore((s) => s.locale)
  const [userId] = useState(getStoredUserId)
  const { sendMessage, sendAction, sendFeedback, reauth } = useWebSocket(
    userId,
    languageStoreToWsLang(locale),
  )
  const t = useTranslations()

  const handleSend = (text: string) => sendMessage(text, pageContext)
  const handleAuthenticated = () => {
    reauth()
    setTimeout(() => sendMessage('I have logged in. Please continue with the booking.'), 600)
  }

  return (
    <motion.aside
      key="chat-dock"
      role="dialog"
      aria-label={t('chat.launcherTitle')}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.25 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[440px]"
    >
      <LoginModal onAuthenticated={handleAuthenticated} />
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex-1 font-display text-sm font-semibold">{t('chat.launcherTitle')}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t('chat.askedWhileViewing', { page: pageContext })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('chat.launcherClose')}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden border-b border-border">
        <ContentStage onAction={sendAction} />
      </div>
      <div className="h-[45%] min-h-0">
        <ChatPanel onSend={handleSend} onFeedback={sendFeedback} />
      </div>
    </motion.aside>
  )
}

/**
 * Floating chat bubble shown on main app pages. Opens the concierge as a
 * slide-in side panel, passing "Asked while viewing X" page context. The full
 * /vibe-booking page remains available separately.
 */
export default function ChatLauncher() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations()
  const pageContext = pageContextLabel(pathname ?? '/')

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('chat.launcherOpen')}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow transition-transform hover:scale-105 md:bottom-6"
        >
          <MessageCircle size={24} aria-hidden />
        </button>
      )}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="chat-dock-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30"
              aria-hidden
            />
            <ChatDockBody pageContext={pageContext} onClose={() => setOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </>
  )
}
