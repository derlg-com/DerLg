'use client'

import { useChatStore } from '@/stores/chat.store'
import { useContentStore } from '@/stores/content.store'
import { useWebSocket } from '@/hooks/useWebSocket'
import ChatPanel from '@/components/vibe-booking/ChatPanel'
import ContentStage from '@/components/vibe-booking/ContentStage'

interface Props {
  userId: string
  language?: 'EN' | 'ZH' | 'KH'
}

export default function SplitScreenLayout({ userId, language = 'EN' }: Props) {
  const { sendMessage, sendAction } = useWebSocket(userId, language)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Chat Panel — fixed 420px on desktop, full-width on mobile */}
      <div className="w-full md:w-[420px] md:min-w-[320px] flex-shrink-0 border-r border-border flex flex-col">
        <ChatPanel onSend={sendMessage} onAction={sendAction} />
      </div>

      {/* Content Stage — fills remaining space */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden">
        <ContentStage onAction={sendAction} />
      </div>
    </div>
  )
}
