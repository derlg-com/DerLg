import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'

describe('Button', () => {
  it('renders its children in a button role', () => {
    render(<Button>Book now</Button>)
    expect(screen.getByRole('button', { name: 'Book now' })).toBeInTheDocument()
  })

  it('applies the accent background only for the primary variant', () => {
    const { rerender } = render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-[var(--accent)]')

    rerender(<Button variant="secondary">Go</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('bg-[var(--accent)]')
  })

  it('expands to the 44px touch minimum on coarse pointers at every size', () => {
    const sizes = ['sm', 'md', 'lg', 'icon'] as const
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>x</Button>)
      const className = screen.getByRole('button').className
      // lg is already 48px tall; the others opt in via the pointer-coarse variant.
      const meetsTouchMinimum =
        className.includes('pointer-coarse:min-h-11') || className.includes('min-h-12')
      expect(meetsTouchMinimum, `size=${size} must reach 44px on touch`).toBe(true)
      unmount()
    }
  })

  it('never drops below the WCAG 2.2 24px minimum on precise pointers', () => {
    const sizes = ['sm', 'md', 'lg', 'icon'] as const
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>x</Button>)
      // min-h-9 = 36px, min-h-10 = 40px, min-h-12 = 48px — all above 24px.
      expect(screen.getByRole('button').className).toMatch(/min-h-(9|10|12)/)
      unmount()
    }
  })

  it('marks itself busy and disabled while loading', () => {
    render(<Button loading>Saving</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('does not fire onClick while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is activated by keyboard', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Confirm</Button>)

    await userEvent.tab()
    expect(screen.getByRole('button')).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})

describe('Badge', () => {
  it('renders each tone with a distinct class set', () => {
    const { rerender } = render(<Badge tone="success">Confirmed</Badge>)
    const success = screen.getByText('Confirmed').className

    rerender(<Badge tone="danger">Confirmed</Badge>)
    expect(screen.getByText('Confirmed').className).not.toBe(success)
  })
})

describe('Card', () => {
  it('renders as the requested element', () => {
    render(
      <Card as="article" aria-label="Trip">
        <CardTitle>Angkor</CardTitle>
        <CardDescription>3 days</CardDescription>
      </Card>,
    )
    expect(screen.getByRole('article', { name: 'Trip' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Angkor' })).toBeInTheDocument()
  })

  it('adds hover feedback only when interactive', () => {
    const { rerender } = render(<Card data-testid="card">x</Card>)
    expect(screen.getByTestId('card').className).not.toContain('hover:')

    rerender(
      <Card interactive data-testid="card">
        x
      </Card>,
    )
    expect(screen.getByTestId('card').className).toContain('hover:')
  })
})

describe('Field', () => {
  it('associates the label with the control', () => {
    render(<Field label="Destination">{(props) => <Input {...props} />}</Field>)
    expect(screen.getByLabelText('Destination')).toBeInTheDocument()
  })

  it('exposes the description through aria-describedby', () => {
    render(
      <Field label="Destination" description="City or province">
        {(props) => <Input {...props} />}
      </Field>,
    )
    expect(screen.getByLabelText('Destination')).toHaveAccessibleDescription('City or province')
  })

  it('marks the control invalid and announces the error', () => {
    render(
      <Field label="Travellers" error="Must be at least 1">
        {(props) => <Input {...props} />}
      </Field>,
    )
    expect(screen.getByLabelText('Travellers')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Must be at least 1')
  })

  it('describes the control by both description and error when both are present', () => {
    render(
      <Field label="Email" description="We only use this for receipts" error="Invalid email">
        {(props) => <Input {...props} />}
      </Field>,
    )
    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2)
  })

  it('propagates required to the control', () => {
    render(
      <Field label="Destination" required>
        {(props) => <Input {...props} />}
      </Field>,
    )
    expect(screen.getByLabelText(/Destination/)).toBeRequired()
  })

  it('keeps a hidden label available to assistive tech', () => {
    render(
      <Field label="Search" hideLabel>
        {(props) => <Input {...props} />}
      </Field>,
    )
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('accepts textarea and select controls', () => {
    render(
      <>
        <Field label="Notes">{(props) => <Textarea {...props} />}</Field>
        <Field label="Mode">
          {(props) => (
            <Select {...props}>
              <option value="van">Van</option>
            </Select>
          )}
        </Field>
      </>,
    )
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Mode').tagName).toBe('SELECT')
  })
})
