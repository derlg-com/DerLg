import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'

function Wrapper({
  side = 'right' as const,
  title,
}: {
  side?: 'right' | 'left' | 'bottom'
  title?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side={side} title={title}>
        <p>Drawer body</p>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet (drawer)', () => {
  it('renders content when open with dialog role and accessible label', () => {
    render(<Wrapper title="AI Assistant" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'AI Assistant')
    expect(screen.getByText('Drawer body')).toBeInTheDocument()
  })

  it('closes via the close button', () => {
    render(<Wrapper />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the overlay is clicked', () => {
    render(<Wrapper />)
    // Sheet renders into a portal on document.body; the overlay is the
    // aria-hidden backdrop sibling of the dialog content.
    const overlay = document.body.querySelector('[aria-hidden]') as HTMLElement
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('supports the bottom side variant', () => {
    render(<Wrapper side="bottom" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('bottom-0')
  })
})
