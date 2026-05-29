'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVibeBookingStore, type LayoutConfig } from '@/stores/vibe-booking.store'

export type DockZone = 'left' | 'right' | 'center' | 'floating'

interface UseDraggableResizableResult {
  layout: LayoutConfig
  panelRef: React.RefObject<HTMLDivElement | null>
  startDrag: (e: React.PointerEvent) => void
  startResize: (e: React.PointerEvent, edge: ResizeEdge) => void
  setDock: (dock: DockZone) => void
  resetLayout: () => void
  toggleCollapsed: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isDragging: boolean
  isResizing: boolean
}

export type ResizeEdge = 'right' | 'left' | 'bottom' | 'top' | 'bottom-right' | 'bottom-left'

const MIN_WIDTH = 320
const MIN_HEIGHT = 240
const SNAP_THRESHOLD = 32
const KEYBOARD_STEP = 8

export function useDraggableResizable(): UseDraggableResizableResult {
  const layout = useVibeBookingStore((s) => s.layout)
  const setLayout = useVibeBookingStore((s) => s.setLayout)
  const resetLayout = useVibeBookingStore((s) => s.resetLayout)
  const toggleCollapsed = useVibeBookingStore((s) => s.toggleCollapsed)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
    origWidth: number
    origHeight: number
    edge?: ResizeEdge
    rafId?: number
  } | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const applySnap = useCallback(
    (x: number, y: number, width: number): { dock: DockZone; x: number; y: number } => {
      if (typeof window === 'undefined') return { dock: 'floating', x, y }
      const winW = window.innerWidth
      if (x < SNAP_THRESHOLD) return { dock: 'left', x: 0, y: 0 }
      if (x + width > winW - SNAP_THRESHOLD) return { dock: 'right', x: winW - width, y: 0 }
      return { dock: 'floating', x, y }
    },
    [],
  )

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!panelRef.current) return
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      const rect = panelRef.current.getBoundingClientRect()
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: rect.left,
        origY: rect.top,
        origWidth: rect.width,
        origHeight: rect.height,
      }
      setIsDragging(true)
    },
    [],
  )

  const startResize = useCallback((e: React.PointerEvent, edge: ResizeEdge) => {
    if (!panelRef.current) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const rect = panelRef.current.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      origWidth: rect.width,
      origHeight: rect.height,
      edge,
    }
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state || state.pointerId !== e.pointerId) return

      if (state.rafId !== undefined) cancelAnimationFrame(state.rafId)
      state.rafId = requestAnimationFrame(() => {
        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY

        if (state.edge) {
          // Resize
          let width = state.origWidth
          let height = state.origHeight
          let x = state.origX
          let y = state.origY

          if (state.edge.includes('right')) width = Math.max(MIN_WIDTH, state.origWidth + dx)
          if (state.edge.includes('left')) {
            width = Math.max(MIN_WIDTH, state.origWidth - dx)
            x = state.origX + (state.origWidth - width)
          }
          if (state.edge.includes('bottom')) height = Math.max(MIN_HEIGHT, state.origHeight + dy)
          if (state.edge.includes('top')) {
            height = Math.max(MIN_HEIGHT, state.origHeight - dy)
            y = state.origY + (state.origHeight - height)
          }
          setLayout({ width, height, x, y, dock: 'floating' })
        } else {
          // Drag
          const x = state.origX + dx
          const y = state.origY + dy
          const snap = applySnap(x, y, state.origWidth)
          setLayout({ x: snap.x, y: snap.y, dock: snap.dock })
        }
      })
    }

    const handleUp = (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state || state.pointerId !== e.pointerId) return
      if (state.rafId !== undefined) cancelAnimationFrame(state.rafId)
      dragStateRef.current = null
      setIsDragging(false)
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [applySnap, setLayout])

  const setDock = useCallback(
    (dock: DockZone) => {
      if (typeof window === 'undefined') return
      const winW = window.innerWidth
      const width = layout.width || 420
      if (dock === 'left') setLayout({ dock, x: 0, y: 0 })
      else if (dock === 'right') setLayout({ dock, x: winW - width, y: 0 })
      else if (dock === 'center') setLayout({ dock, x: (winW - width) / 2, y: 80 })
      else setLayout({ dock })
    },
    [layout.width, setLayout],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP
      let handled = true
      if (e.shiftKey) {
        // Resize via keyboard
        if (e.key === 'ArrowRight') setLayout({ width: layout.width + step })
        else if (e.key === 'ArrowLeft') setLayout({ width: Math.max(MIN_WIDTH, layout.width - step) })
        else if (e.key === 'ArrowDown') setLayout({ height: layout.height + step })
        else if (e.key === 'ArrowUp')
          setLayout({ height: Math.max(MIN_HEIGHT, layout.height - step) })
        else handled = false
      } else {
        // Move via keyboard
        if (e.key === 'ArrowRight') setLayout({ x: layout.x + step, dock: 'floating' })
        else if (e.key === 'ArrowLeft') setLayout({ x: layout.x - step, dock: 'floating' })
        else if (e.key === 'ArrowDown') setLayout({ y: layout.y + step, dock: 'floating' })
        else if (e.key === 'ArrowUp') setLayout({ y: layout.y - step, dock: 'floating' })
        else handled = false
      }
      if (handled) e.preventDefault()
    },
    [layout.height, layout.width, layout.x, layout.y, setLayout],
  )

  return {
    layout,
    panelRef,
    startDrag,
    startResize,
    setDock,
    resetLayout,
    toggleCollapsed,
    onKeyDown,
    isDragging,
    isResizing,
  }
}
