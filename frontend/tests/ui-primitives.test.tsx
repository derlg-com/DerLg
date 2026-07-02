import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Pagination, pageWindow } from '@/components/ui/pagination'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast, Toaster, useToastStore } from '@/components/ui/toast'
import { Logo } from '@/components/shared/Logo'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { GradientText } from '@/components/shared/GradientText'
import { RatingBubbles } from '@/components/ui/rating-bubbles'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Radio, RadioGroup } from '@/components/ui/radio'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

describe('ui primitives', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Badge renders its content', () => {
    render(<Badge variant="success">Verified</Badge>)
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('Input forwards aria-invalid', () => {
    render(<Input aria-invalid placeholder="email" />)
    expect(screen.getByPlaceholderText('email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('Input maps the invalid prop to aria-invalid', () => {
    render(<Input invalid placeholder="email" />)
    expect(screen.getByPlaceholderText('email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('Input renders start and end icons with padding offsets', () => {
    render(
      <Input
        placeholder="search"
        startIcon={<span data-testid="lead">L</span>}
        endIcon={<span data-testid="trail">T</span>}
      />,
    )
    expect(screen.getByTestId('lead')).toBeInTheDocument()
    expect(screen.getByTestId('trail')).toBeInTheDocument()
    const field = screen.getByPlaceholderText('search')
    expect(field).toHaveClass('pl-10')
    expect(field).toHaveClass('pr-10')
  })

  it('EmptyState shows title and description', () => {
    render(<EmptyState title="No trips" description="Try later" />)
    expect(screen.getByText('No trips')).toBeInTheDocument()
    expect(screen.getByText('Try later')).toBeInTheDocument()
  })

  it('Tabs switches panels on trigger click', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('Panel A')).toBeInTheDocument()
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'B' }))
    expect(screen.getByText('Panel B')).toBeInTheDocument()
  })

  it('Switch toggles aria-checked', () => {
    function Wrapper() {
      const [on, setOn] = useState(false)
      return <Switch checked={on} onCheckedChange={setOn} aria-label="notif" />
    }
    render(<Wrapper />)
    const sw = screen.getByRole('switch', { name: 'notif' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('pageWindow builds compact windows', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(5, 20)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 20])
  })

  it('Pagination "next" calls the handler', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('Dialog renders content when open and closes via the close button', () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Hi</DialogTitle>
          </DialogContent>
        </Dialog>
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hi')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('toast() appears in the Toaster and can be dismissed', () => {
    render(<Toaster />)
    act(() => {
      toast({ title: 'Saved', variant: 'success', duration: 0 })
    })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('Button supports gradient + gold variants and xl size', () => {
    const { rerender } = render(<Button variant="gradient">Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-gradient-brand')
    rerender(
      <Button variant="gold" size="xl">
        Notify
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Notify' })).toHaveClass('bg-gradient-gold')
  })

  it('Card renders variants', () => {
    const { container, rerender } = render(<Card variant="glass">x</Card>)
    expect(container.firstChild).toHaveClass('glass')
    rerender(<Card variant="interactive">x</Card>)
    expect(container.firstChild).toHaveClass('rounded-2xl')
  })

  it('Logo renders the wordmark and links home', () => {
    render(<Logo />)
    const link = screen.getByRole('link', { name: 'DerLg home' })
    expect(link).toHaveAttribute('href', '/')
    expect(screen.getByText('DerLg')).toBeInTheDocument()
  })

  it('SectionHeading + GradientText render', () => {
    render(
      <SectionHeading
        eyebrow="Signature"
        title={
          <>
            Vibe <GradientText>Booking</GradientText>
          </>
        }
        subtitle="Chat to book."
      />,
    )
    expect(screen.getByRole('heading', { name: /Vibe Booking/ })).toBeInTheDocument()
    expect(screen.getByText('Chat to book.')).toBeInTheDocument()
  })

  it('Badge supports the live variant', () => {
    render(<Badge variant="live">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('RatingBubbles renders value, count, and an accessible label', () => {
    render(<RatingBubbles rating={4.8} count={245} />)
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('(245)')).toBeInTheDocument()
    expect(screen.getByLabelText('4.8 of 5 bubbles, 245 reviews')).toBeInTheDocument()
  })

  it('RatingBubbles clamps out-of-range scores and omits count when absent', () => {
    render(<RatingBubbles rating={9} />)
    expect(screen.getByText('5.0')).toBeInTheDocument()
    expect(screen.getByLabelText('5.0 of 5 bubbles')).toBeInTheDocument()
  })

  it('Progress exposes determinate value via ARIA attributes', () => {
    render(<Progress value={40} label="Upload" />)
    const bar = screen.getByRole('progressbar', { name: 'Upload' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuetext', '40%')
  })

  it('Progress respects a custom max', () => {
    render(<Progress value={5} max={10} label="Steps" />)
    const bar = screen.getByRole('progressbar', { name: 'Steps' })
    expect(bar).toHaveAttribute('aria-valuenow', '5')
    expect(bar).toHaveAttribute('aria-valuemax', '10')
    expect(bar).toHaveAttribute('aria-valuetext', '50%')
  })

  it('Progress clamps out-of-range values to the track bounds', () => {
    const { rerender } = render(<Progress value={150} label="Clamp" />)
    expect(screen.getByRole('progressbar', { name: 'Clamp' })).toHaveAttribute(
      'aria-valuetext',
      '100%',
    )
    rerender(<Progress value={-20} label="Clamp" />)
    expect(screen.getByRole('progressbar', { name: 'Clamp' })).toHaveAttribute(
      'aria-valuetext',
      '0%',
    )
  })

  it('Progress is indeterminate when no value is provided', () => {
    render(<Progress label="Working" />)
    const bar = screen.getByRole('progressbar', { name: 'Working' })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).not.toHaveAttribute('aria-valuetext')
  })
})

describe('form components', () => {
  it('Select renders options and forwards value/onChange', () => {
    const onChange = vi.fn()
    render(
      <Select aria-label="region" value="siem-reap" onChange={onChange}>
        <option value="phnom-penh">Phnom Penh</option>
        <option value="siem-reap">Siem Reap</option>
      </Select>,
    )
    const select = screen.getByRole('combobox', { name: 'region' }) as HTMLSelectElement
    expect(select.value).toBe('siem-reap')
    fireEvent.change(select, { target: { value: 'phnom-penh' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('Textarea forwards aria-invalid and value', () => {
    render(<Textarea aria-invalid placeholder="notes" defaultValue="hello" />)
    const area = screen.getByPlaceholderText('notes')
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveValue('hello')
  })

  it('Checkbox toggles checked state and links its label', () => {
    function Wrapper() {
      const [on, setOn] = useState(false)
      return (
        <Checkbox
          label="Use loyalty points"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
      )
    }
    render(<Wrapper />)
    const box = screen.getByRole('checkbox', { name: 'Use loyalty points' })
    expect(box).not.toBeChecked()
    fireEvent.click(screen.getByText('Use loyalty points'))
    expect(box).toBeChecked()
  })

  it('Checkbox maps the invalid prop to aria-invalid', () => {
    render(<Checkbox invalid label="Accept" />)
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('Radio group exposes radiogroup role and single selection', () => {
    function Wrapper() {
      const [val, setVal] = useState('card')
      return (
        <RadioGroup aria-label="payment">
          <Radio
            name="pay"
            value="card"
            label="Card"
            checked={val === 'card'}
            onChange={() => setVal('card')}
          />
          <Radio
            name="pay"
            value="qr"
            label="QR"
            checked={val === 'qr'}
            onChange={() => setVal('qr')}
          />
        </RadioGroup>
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole('radiogroup', { name: 'payment' })).toBeInTheDocument()
    const card = screen.getByRole('radio', { name: 'Card' })
    const qr = screen.getByRole('radio', { name: 'QR' })
    expect(card).toBeChecked()
    expect(qr).not.toBeChecked()
    fireEvent.click(screen.getByText('QR'))
    expect(qr).toBeChecked()
    expect(card).not.toBeChecked()
  })

  it('DatePicker opens a calendar and selects a day', () => {
    function Wrapper() {
      const [date, setDate] = useState('')
      return (
        <DatePicker
          value={date}
          onChange={setDate}
          placeholder="Pick a date"
          aria-label="start date"
        />
      )
    }
    render(<Wrapper />)
    const trigger = screen.getByRole('button', { name: 'start date' })
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Pick the 15th of the displayed month.
    fireEvent.click(screen.getByRole('button', { name: '15' }))
    // Calendar closes and a date is now selected (placeholder gone).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Pick a date')).not.toBeInTheDocument()
  })

  it('DatePicker disables days before the min date', () => {
    render(<DatePicker value="2026-06-15" min="2026-06-10" aria-label="start" />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '20' })).not.toBeDisabled()
  })
})
