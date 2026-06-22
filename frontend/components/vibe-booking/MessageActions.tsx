'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, RefreshCcwIcon, ShareIcon } from 'lucide-react'
import { Action, Actions } from '@/components/ui/actions'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { buildShareLink } from '@/lib/share'

interface Props {
  content: string
  onRetry?: () => void
}

export default function MessageActions({ content, onRetry }: Props) {
  const [copied, setCopied] = useState(false)
  const sessionId = useVibeBookingStore((s) => s.sessionId)

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const share = async () => {
    if (!sessionId) return
    await navigator.clipboard.writeText(buildShareLink(sessionId))
  }

  return (
    <Actions className="mt-1">
      {onRetry && (
        <Action label="Retry" tooltip="Retry" onClick={onRetry}>
          <RefreshCcwIcon className="size-4" />
        </Action>
      )}
      <Action label="Copy" tooltip={copied ? 'Copied!' : 'Copy'} onClick={copy}>
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </Action>
      <Action label="Share" tooltip="Share" onClick={share} disabled={!sessionId}>
        <ShareIcon className="size-4" />
      </Action>
    </Actions>
  )
}
