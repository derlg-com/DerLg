import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Composer } from '@/components/chat/composer'
import { BlockedPanel, ConnectionStatusBar } from '@/components/chat/connection-status'
import { AgentBubble, StreamingBubble, UserBubble } from '@/components/chat/message-bubble'
import { ReasoningPanel } from '@/components/chat/reasoning-panel'
import { ToolStatusChips } from '@/components/chat/tool-status'
import { renderWithProviders } from '@/tests/helpers/render'
import type { AgentTurn, UserTurn } from '@/lib/vibe/transcript'

const agentTurn: AgentTurn = {
  kind: 'agent',
  id: 'a1',
  text: 'I found three temple trips.',
  blocks: [],
  suggestions: ['Show hotels nearby'],
}

const userTurn: UserTurn = { kind: 'user', id: 'u1', text: 'Find me a temple tour' }

describe('Composer', () => {
  it('sends on Enter and clears the field', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Find me a temple tour{Enter}')

    expect(onSend).toHaveBeenCalledWith('Find me a temple tour')
    expect(input).toHaveValue('')
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'line one{Shift>}{Enter}{/Shift}line two')

    expect(onSend).not.toHaveBeenCalled()
    expect(input).toHaveValue('line one\nline two')
  })

  it('refuses to send whitespace only', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} />)

    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps the send button disabled until there is something to send', async () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox'), 'hello')
    expect(button).toBeEnabled()
  })

  it('has an accessible label even though the visible label is hidden', () => {
    renderWithProviders(<Composer onSend={vi.fn()} />)
    expect(screen.getByLabelText(/message the concierge/i)).toBeInTheDocument()
  })

  it('stays usable while disconnected, since messages are queued', async () => {
    const onSend = vi.fn()
    renderWithProviders(<Composer onSend={onSend} notice="Not connected yet" />)

    await userEvent.type(screen.getByRole('textbox'), 'queued message{Enter}')
    expect(onSend).toHaveBeenCalledWith('queued message')
    expect(screen.getByText('Not connected yet')).toBeInTheDocument()
  })
})

describe('message bubbles', () => {
  it('labels the user role for screen readers, not just by alignment', () => {
    renderWithProviders(
      <ul>
        <UserBubble turn={userTurn} />
      </ul>,
    )
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Find me a temple tour')).toBeInTheDocument()
  })

  it('shows the page a question was asked from', () => {
    renderWithProviders(
      <ul>
        <UserBubble turn={{ ...userTurn, context: 'Angkor Wat trip' }} />
      </ul>,
    )
    expect(screen.getByText(/Angkor Wat trip/)).toBeInTheDocument()
  })

  it('renders the agent reply with its suggestion chips', () => {
    renderWithProviders(
      <ul>
        <AgentBubble turn={agentTurn} onFeedback={vi.fn()} onSuggestion={vi.fn()} />
      </ul>,
    )
    expect(screen.getByText('I found three temple trips.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show hotels nearby' })).toBeInTheDocument()
  })

  it('sends the chosen suggestion as the next message', async () => {
    const onSuggestion = vi.fn()
    renderWithProviders(
      <ul>
        <AgentBubble turn={agentTurn} onFeedback={vi.fn()} onSuggestion={onSuggestion} />
      </ul>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Show hotels nearby' }))
    expect(onSuggestion).toHaveBeenCalledWith('Show hotels nearby')
  })

  it('reports feedback against the message id', async () => {
    const onFeedback = vi.fn()
    renderWithProviders(
      <ul>
        <AgentBubble turn={agentTurn} onFeedback={onFeedback} onSuggestion={vi.fn()} />
      </ul>,
    )

    await userEvent.click(screen.getByRole('button', { name: /yes, helpful/i }))
    expect(onFeedback).toHaveBeenCalledWith('a1', true)
  })

  it('replaces the feedback control with thanks once given', () => {
    renderWithProviders(
      <ul>
        <AgentBubble
          turn={{ ...agentTurn, feedback: 'up' }}
          onFeedback={vi.fn()}
          onSuggestion={vi.fn()}
        />
      </ul>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/thanks/i)
    expect(screen.queryByRole('button', { name: /yes, helpful/i })).not.toBeInTheDocument()
  })

  it('announces the streaming reply politely without restarting on each chunk', () => {
    renderWithProviders(
      <ul>
        <StreamingBubble text="I found " reasoning="" />
      </ul>,
    )

    const live = screen.getByLabelText(/concierge is replying/i)
    expect(live).toHaveAttribute('aria-live', 'polite')
    // atomic=false so additions are read, not the whole paragraph again.
    expect(live).toHaveAttribute('aria-atomic', 'false')
  })

  it('shows a thinking indicator before any text arrives', () => {
    renderWithProviders(
      <ul>
        <StreamingBubble text="" reasoning="" />
      </ul>,
    )
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })
})

describe('ReasoningPanel', () => {
  it('is collapsed by default so it cannot bury the answer', () => {
    renderWithProviders(<ReasoningPanel text="Considering temple options." />)

    const details = screen.getByText(/thinking process/i).closest('details')
    expect(details).not.toHaveAttribute('open')
  })

  it('expands on click', async () => {
    renderWithProviders(<ReasoningPanel text="Considering temple options." />)

    await userEvent.click(screen.getByText(/thinking process/i))
    expect(screen.getByText(/thinking process/i).closest('details')).toHaveAttribute('open')
  })

  it('renders nothing when there is no reasoning', () => {
    const { container } = renderWithProviders(<ReasoningPanel text="   " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is not a live region unless the reply is in flight', () => {
    const { container } = renderWithProviders(<ReasoningPanel text="abc" />)
    expect(container.querySelector('[aria-live="off"]')).not.toBeNull()
  })
})

describe('ToolStatusChips', () => {
  it('names the work being done using the tools catalogue', () => {
    renderWithProviders(
      <ToolStatusChips tools={[{ name: 'search_trips', status: 'running' }]} />,
    )
    expect(screen.getByText('Searching trips…')).toBeInTheDocument()
  })

  it('falls back to a generic label for an unknown tool', () => {
    renderWithProviders(
      <ToolStatusChips tools={[{ name: 'brand_new_tool', status: 'running' }]} />,
    )
    expect(screen.getByText('Working…')).toBeInTheDocument()
  })

  it('renders nothing when no tool is running', () => {
    const { container } = renderWithProviders(<ToolStatusChips tools={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ConnectionStatusBar', () => {
  it('stays out of the way when healthy', () => {
    renderWithProviders(
      <ConnectionStatusBar status="connected" queueLength={0} onRetry={vi.fn()} />,
    )
    // Present for assistive tech, but not visually intrusive.
    expect(screen.getByRole('status')).toHaveClass('sr-only')
  })

  it('reports reconnecting with a retry action', async () => {
    const onRetry = vi.fn()
    renderWithProviders(
      <ConnectionStatusBar status="reconnecting" queueLength={0} onRetry={onRetry} />,
    )

    const bar = screen.getByRole('status')
    expect(bar).toHaveTextContent(/reconnecting/i)

    await userEvent.click(within(bar).getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('tells the user how many messages are waiting', () => {
    renderWithProviders(
      <ConnectionStatusBar status="reconnecting" queueLength={2} onRetry={vi.fn()} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/2 messages waiting/i)
  })
})

describe('BlockedPanel', () => {
  it('explains an expired session distinctly from a rejected origin', () => {
    const { unmount } = renderWithProviders(<BlockedPanel code={1008} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i)
    unmount()

    renderWithProviders(<BlockedPanel code={4403} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/not allowed to reach/i)
  })
})
