import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollRail } from '@/components/ui/scroll-rail'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'
import { ToastProvider, useToast } from '@/components/ui/toast'

describe('Tabs', () => {
  function Harness() {
    return (
      <Tabs defaultValue="trips">
        <TabList label="Content type">
          <Tab value="trips">Trips</Tab>
          <Tab value="hotels">Hotels</Tab>
          <Tab value="guides">Guides</Tab>
        </TabList>
        <TabPanel value="trips">Trips panel</TabPanel>
        <TabPanel value="hotels">Hotels panel</TabPanel>
        <TabPanel value="guides">Guides panel</TabPanel>
      </Tabs>
    )
  }

  it('shows only the selected panel', () => {
    render(<Harness />)
    expect(screen.getByText('Trips panel')).toBeInTheDocument()
    expect(screen.queryByText('Hotels panel')).not.toBeInTheDocument()
  })

  it('wires aria-selected, aria-controls and aria-labelledby', () => {
    render(<Harness />)
    const selected = screen.getByRole('tab', { name: 'Trips' })
    expect(selected).toHaveAttribute('aria-selected', 'true')

    const panel = screen.getByRole('tabpanel')
    expect(selected.getAttribute('aria-controls')).toBe(panel.getAttribute('id'))
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.getAttribute('id'))
  })

  it('makes only the selected tab tabbable (roving tabindex)', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Trips' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Hotels' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves selection with arrow keys and wraps at the ends', async () => {
    render(<Harness />)
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: 'Trips' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('Hotels panel')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByText('Guides panel')).toBeInTheDocument()
  })

  it('jumps to first and last with Home and End', async () => {
    render(<Harness />)
    await userEvent.tab()

    await userEvent.keyboard('{End}')
    expect(screen.getByText('Guides panel')).toBeInTheDocument()

    await userEvent.keyboard('{Home}')
    expect(screen.getByText('Trips panel')).toBeInTheDocument()
  })

  it('supports a controlled value', async () => {
    const onValueChange = vi.fn()
    render(
      <Tabs value="hotels" defaultValue="trips" onValueChange={onValueChange}>
        <TabList label="Content type">
          <Tab value="trips">Trips</Tab>
          <Tab value="hotels">Hotels</Tab>
        </TabList>
        <TabPanel value="trips">Trips panel</TabPanel>
        <TabPanel value="hotels">Hotels panel</TabPanel>
      </Tabs>,
    )
    expect(screen.getByText('Hotels panel')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Trips' }))
    expect(onValueChange).toHaveBeenCalledWith('trips')
    // Controlled: the parent owns the value, so the panel must not change itself.
    expect(screen.getByText('Hotels panel')).toBeInTheDocument()
  })

  it('throws a helpful error when used outside Tabs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Tab value="x">X</Tab>)).toThrow(/must be used inside <Tabs>/)
    spy.mockRestore()
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'list' as const, label: 'List' },
    { value: 'map' as const, label: 'Map' },
  ]

  it('renders a labelled radiogroup with the current selection checked', () => {
    render(
      <SegmentedControl label="View mode" value="list" onValueChange={vi.fn()} options={options} />,
    )
    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Map' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the new value on click', async () => {
    const onValueChange = vi.fn()
    render(
      <SegmentedControl
        label="View mode"
        value="list"
        onValueChange={onValueChange}
        options={options}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Map' }))
    expect(onValueChange).toHaveBeenCalledWith('map')
  })

  it('moves selection with arrow keys, wrapping around', async () => {
    const onValueChange = vi.fn()
    render(
      <SegmentedControl
        label="View mode"
        value="list"
        onValueChange={onValueChange}
        options={options}
      />,
    )
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('map')

    await userEvent.keyboard('{ArrowLeft}')
    expect(onValueChange).toHaveBeenLastCalledWith('map')
  })
})

describe('Switch', () => {
  it('renders a labelled switch reflecting its state', () => {
    render(<Switch checked onCheckedChange={vi.fn()} label="Trip reminders" />)
    const control = screen.getByRole('switch', { name: 'Trip reminders' })
    expect(control).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles on click and on keyboard activation', async () => {
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Trip reminders" />)

    await userEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    await userEvent.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
  })

  it('exposes its description to assistive tech', () => {
    render(
      <Switch
        checked={false}
        onCheckedChange={vi.fn()}
        label="Trip reminders"
        description="Push a reminder 24 hours before departure."
      />,
    )
    expect(screen.getByRole('switch')).toHaveAccessibleDescription(
      'Push a reminder 24 hours before departure.',
    )
  })

  it('does not toggle while disabled', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} label="Reminders" disabled />,
    )
    await userEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})

describe('Toast', () => {
  function Harness() {
    const { show } = useToast()
    return (
      <Button onClick={() => show({ tone: 'success', title: 'Booking confirmed' })}>Notify</Button>
    )
  }

  it('announces toasts in a polite live region', async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))

    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Booking confirmed')
  })

  it('dismisses a toast on demand', async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Notify' }))
    await userEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
    expect(screen.getByRole('status')).not.toHaveTextContent('Booking confirmed')
  })

  it('auto-dismisses after the configured duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(
        <ToastProvider duration={1000}>
          <Harness />
        </ToastProvider>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Notify' }))
      expect(screen.getByRole('status')).toHaveTextContent('Booking confirmed')

      vi.advanceTimersByTime(1100)
      await waitFor(() =>
        expect(screen.getByRole('status')).not.toHaveTextContent('Booking confirmed'),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws when useToast is called outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/must be used inside <ToastProvider>/)
    spy.mockRestore()
  })
})

describe('Avatar', () => {
  it('falls back to initials and keeps the name available', () => {
    render(<Avatar name="Sokha Chan" />)
    expect(screen.getByText('SC')).toBeInTheDocument()
    expect(screen.getByText('Sokha Chan')).toHaveClass('sr-only')
  })

  it('hides the decorative image from assistive tech', () => {
    render(<Avatar name="Sokha Chan" src="https://example.com/a.jpg" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('ScrollRail', () => {
  it('exposes a labelled group that is reachable by keyboard', () => {
    render(
      <ScrollRail label="Featured trips">
        <div>Trip 1</div>
      </ScrollRail>,
    )
    const rail = screen.getByRole('group', { name: 'Featured trips' })
    expect(rail).toBeInTheDocument()
    // A scrollable region must be focusable or keyboard users cannot scroll it.
    expect(rail).toHaveAttribute('tabindex', '0')
  })
})

describe('Loading, empty and error states', () => {
  it('announces a busy loading region', () => {
    render(
      <LoadingRegion label="Loading trips">
        <Skeleton className="h-4 w-full" />
      </LoadingRegion>,
    )
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveTextContent('Loading trips')
  })

  it('offers a next action from an empty state', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="No trips match"
        description="Try widening the price range."
        action={
          <Button variant="secondary" size="sm" onClick={onClick}>
            Clear filters
          </Button>
        }
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('accepts a link as the empty-state action, for navigation that must survive reload', () => {
    render(
      <EmptyState
        title="No trips match"
        // An absolute URL keeps this a plain anchor: the Next lint rule requires
        // its Link component for internal page paths, which this primitive test
        // deliberately does not depend on.
        action={<a href="https://example.com/trips">Clear filters</a>}
      />,
    )
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      'https://example.com/trips',
    )
  })

  it('announces failures and offers retry', async () => {
    const onRetry = vi.fn()
    render(<ErrorState title="Could not load trips" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load trips')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
