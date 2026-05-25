import { describe, it, expect, beforeEach } from 'vitest'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

describe('vibe-booking.store', () => {
  beforeEach(() => {
    useVibeBookingStore.getState().clearMessages()
    useVibeBookingStore.getState().clearAllContent()
    useVibeBookingStore.getState().resetLayout()
  })

  it('addMessage caps at 50 messages', () => {
    const { addMessage } = useVibeBookingStore.getState()
    for (let i = 0; i < 60; i++) {
      addMessage({
        id: `m${i}`,
        role: 'user',
        content: `msg ${i}`,
        type: 'text',
        timestamp: new Date().toISOString(),
      })
    }
    expect(useVibeBookingStore.getState().messages.length).toBe(50)
    expect(useVibeBookingStore.getState().messages[0].id).toBe('m10')
  })

  it('appendToStreamingMessage appends to last assistant message', () => {
    const { addMessage, appendToStreamingMessage } = useVibeBookingStore.getState()
    addMessage({
      id: 'a1',
      role: 'assistant',
      content: 'Hello',
      type: 'text',
      timestamp: new Date().toISOString(),
    })
    appendToStreamingMessage(' world')
    const last = useVibeBookingStore.getState().messages.at(-1)
    expect(last?.content).toBe('Hello world')
  })

  it('appendToStreamingMessage creates a new message when none is streaming', () => {
    const { appendToStreamingMessage } = useVibeBookingStore.getState()
    appendToStreamingMessage('first chunk')
    const msgs = useVibeBookingStore.getState().messages
    expect(msgs.length).toBe(1)
    expect(msgs[0].content).toBe('first chunk')
    expect(msgs[0].role).toBe('assistant')
  })

  it('addContentItem sets activeContentId', () => {
    const { addContentItem } = useVibeBookingStore.getState()
    addContentItem({
      id: 'c1',
      type: 'trip_cards',
      data: {},
      actions: [],
      metadata: {},
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
    expect(useVibeBookingStore.getState().activeContentId).toBe('c1')
  })

  it('resetLayout restores defaults', () => {
    const { setLayout, resetLayout } = useVibeBookingStore.getState()
    setLayout({ x: 999, y: 999, width: 800 })
    resetLayout()
    const layout = useVibeBookingStore.getState().layout
    expect(layout.x).toBe(0)
    expect(layout.width).toBe(420)
  })
})
