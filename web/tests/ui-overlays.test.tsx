import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Dialog, Sheet } from '@/components/ui/overlay'
import { Popover, Tooltip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

function DialogHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          onClose()
        }}
        title="Confirm booking"
        description="This holds your seat for 15 minutes."
      >
        <input aria-label="Name" />
        <Button>Submit</Button>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="Hidden">
        body
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes a modal dialog labelled by its title and described by its description', () => {
    render(
      <Dialog open onClose={vi.fn()} title="Confirm booking" description="Holds your seat.">
        body
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Confirm booking')
    expect(dialog).toHaveAccessibleDescription('Holds your seat.')
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        body
      </Dialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on backdrop click', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        body
      </Dialog>,
    )
    await userEvent.click(screen.getByTestId('overlay-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes via the close button', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        body
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('locks body scroll while open and restores it after', () => {
    const { unmount } = render(
      <Dialog open onClose={vi.fn()} title="Confirm">
        body
      </Dialog>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('traps Tab focus inside the dialog', async () => {
    render(
      <Dialog open onClose={vi.fn()} title="Confirm">
        <input aria-label="First" />
        <input aria-label="Last" />
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog')
    // Tab repeatedly; focus must never escape the dialog subtree.
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('restores focus to the trigger after closing', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open' })

    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('honours a data-autofocus target', async () => {
    render(
      <Dialog open onClose={vi.fn()} title="Confirm">
        <input aria-label="First" />
        <input aria-label="Preferred" data-autofocus />
      </Dialog>,
    )
    await waitFor(() => expect(screen.getByLabelText('Preferred')).toHaveFocus())
  })
})

describe('Sheet', () => {
  it('renders as a modal dialog anchored to an edge', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Filters" side="bottom">
        body
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveAttribute('aria-modal', 'true')
  })
})

describe('Tooltip', () => {
  it('shows on focus and links itself via aria-describedby', async () => {
    render(
      <Tooltip content="Opens the concierge">
        <button type="button">Chat</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Chat' })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await userEvent.tab()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Opens the concierge')
    expect(trigger).toHaveAccessibleDescription('Opens the concierge')
  })
})

describe('Popover', () => {
  it('toggles and reports expanded state', async () => {
    render(
      <Popover label="Filters" trigger={<span>Open filters</span>}>
        <button type="button">Reset</button>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open filters' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Popover label="Filters" trigger={<span>Open filters</span>}>
        <button type="button">Reset</button>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open filters' })

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes on outside pointer down', async () => {
    render(
      <div>
        <Popover label="Filters" trigger={<span>Open filters</span>}>
          <button type="button">Reset</button>
        </Popover>
        <button type="button">Outside</button>
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open filters' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
