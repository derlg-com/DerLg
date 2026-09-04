'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ToolStatus } from '@/lib/vibe/transcript'

/**
 * Tool activity chips.
 *
 * Shows WHICH work the agent is doing rather than a generic spinner, so a long
 * turn reads as progress instead of a hang. The tools.* catalogue has a real
 * label per tool; anything unrecognised falls back to the generic "Working…".
 */
export function ToolStatusChips({ tools }: { tools: ToolStatus[] }) {
  const t = useTranslations('tools')
  const tChat = useTranslations('chat')

  if (tools.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5" aria-label={tChat('toolsLabel')}>
      <ul className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <li key={tool.name}>
            <Badge tone={tool.status === 'completed' ? 'success' : 'info'}>
              <span
                className={cn(
                  'mr-1.5 inline-block size-1.5 rounded-full bg-current',
                  tool.status !== 'completed' && 'motion-safe:animate-pulse',
                )}
                aria-hidden="true"
              />
              {labelFor(tool.name, t)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

function labelFor(name: string, t: ReturnType<typeof useTranslations<'tools'>>): string {
  // t.has() avoids the dev-mode missing-key warning for tools added server-side
  // after this catalogue was written.
  return t.has(name as never) ? t(name as never) : t('running')
}
