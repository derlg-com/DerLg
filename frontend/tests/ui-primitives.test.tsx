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
    rerender(<Button variant="gold" size="xl">Notify</Button>)
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
        title={<>Vibe <GradientText>Booking</GradientText></>}
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
})
