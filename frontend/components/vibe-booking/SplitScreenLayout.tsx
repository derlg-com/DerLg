'use client'

import { useEffect, useRef } from 'react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { useDraggableResizable, type ResizeEdge } from '@/hooks/useDraggableResizable'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import ChatPanel from '@/components/vibe-booking/ChatPanel'
import ContentStage from '@/components/vibe-booking/ContentStage'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useWebSocket } from '@/hooks/useWebSocket'

interface Props {
  userId: string
  language?: 'EN' | 'ZH' | 'KH'
}

const RESIZE_EDGES: { edge: ResizeEdge; cursor: string; className: string }[] = [
  { edge: 'right', cursor: 'ew-resize', className: 'right-0 top-2 bottom-2 w-1 cursor-ew-resize' },
  { edge: 'left', cursor: 'ew-resize', className: 'left-0 top-2 bottom-2 w-1 cursor-ew-resize' },
  { edge: 'bottom', cursor: 'ns-resize', className: 'bottom-0 left-2 right-2 h-1 cursor-ns-resize' },
  { edge: 'top', cursor: 'ns-resize', className: 'top-0 left-2 right-2 h-1 cursor-ns-resize' },
  {
    edge: 'bottom-right',
    cursor: 'nwse-resize',
    className: 'bottom-0 right-0 w-3 h-3 cursor-nwse-resize',
  },
  {
    edge: 'bottom-left',
    cursor: 'nesw-resize',
    className: 'bottom-0 left-0 w-3 h-3 cursor-nesw-resize',
  },
]

export default function SplitScreenLayout({ userId, language = 'EN' }: Props) {
  const { sendMessage, sendAction } = useWebSocket(userId, language)
  const { layout, panelRef, startDrag, startResize, resetLayout, toggleCollapsed, onKeyDown } =
    useDraggableResizable()
  const setLayout = useVibeBookingStore((s) => s.setLayout)

  // Initialize default Y/height once on mount
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (typeof window === 'undefined') return
    if (layout.height === 0) {
      setLayout({ height: window.innerHeight - 16, x: window.innerWidth - layout.width, y: 0 })
    }
  }, [layout.height, layout.width, setLayout])

  const isFloating = layout.dock === 'floating' || layout.dock === 'center'

  // Focus trap on truly floating panel — when modal-like over the content stage.
  useFocusTrap(panelRef, !layout.collapsed && isFloating, toggleCollapsed)

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Mobile: stacked single-pane */}
      <div className="md:hidden flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-hidden">
          <ContentStage onAction={sendAction} />
        </div>
        <div className="h-1/2 border-t border-border">
          <ChatPanel onSend={sendMessage} onAction={sendAction} />
        </div>
      </div>

      {/* Desktop: floating draggable panel + content stage */}
      <div className="hidden md:block h-full">
        <div className="absolute inset-0">
          <ContentStage onAction={sendAction} />
        </div>

        {!layout.collapsed ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="DerLg AI Concierge chat panel"
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="absolute bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
            style={{
              left: `${layout.x}px`,
              top: `${layout.y}px`,
              width: `${layout.width}px`,
              height: layout.height ? `${layout.height}px` : 'calc(100vh - 16px)',
              willChange: isFloating ? 'transform, width, height' : undefined,
            }}
          >
            {/* Drag handle (also serves as title bar) */}
            <div
              onPointerDown={startDrag}
              className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 cursor-grab active:cursor-grabbing select-none"
            >
              <span className="font-semibold text-sm flex-1">DerLg AI Concierge</span>
              <LanguageSwitcher />
              <button
                type="button"
                onClick={resetLayout}
                className="text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Reset panel layout"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Collapse panel"
              >
                ─
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <ChatPanel onSend={sendMessage} onAction={sendAction} />
            </div>

            {/* Resize handles (skip when docked left/right to avoid awkward edges) */}
            {RESIZE_EDGES.map(({ edge, className }) => (
              <div
                key={edge}
                onPointerDown={(e) => startResize(e, edge)}
                className={`absolute z-10 ${className}`}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Open AI concierge chat"
          >
            <span className="text-2xl">💬</span>
          </button>
        )}
      </div>
    </div>
  )
}
