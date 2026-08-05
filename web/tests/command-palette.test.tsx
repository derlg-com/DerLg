import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CommandPalette, useCommandPalette } from '@/components/layout/command-palette'
import { Button } from '@/components/ui'

import { renderWithProviders } from './helpers/render'

const push = vi.fn()

// The palette navigates on selection, so the locale-aware router is stubbed.
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}))

const SEARCH_RESULTS = {
  success: true,
  data: {
    items: [
      { id: 't1', kind: 'trip', title: 'Angkor Classic Discovery', category: 'temples', basePriceUsd: 299 },
      { id: 'h1', kind: 'hotel', title: 'Shinta Mani Angkor', basePriceUsd: 120 },
      { id: 'p1', kind: 'place', title: 'Angkor Wat', basePriceUsd: null },
    ],
    total: 3,
    page: 1,
    limit: 8,
    totalPages: 1,
  },
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  push.mockReset()
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(SEARCH_RESULTS), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3003')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function Harness() {
  const { open, setOpen } = useCommandPalette()
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open search</Button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  )
}

describe('CommandPalette', () => {
  it('is closed until opened', () => {
    renderWithProviders(<Harness />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('opens on Cmd+K and closes on a second press', async () => {
    renderWithProviders(<Harness />)

    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(await screen.findByRole('combobox')).toBeInTheDocument()

    await userEvent.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })

  it('opens on Ctrl+K for non-Mac keyboards', async () => {
    renderWithProviders(<Harness />)
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('exposes the ARIA combobox contract', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))

    const input = await screen.findByRole('combobox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-controls')
  })

  it('does not query the backend below two characters', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))

    await userEvent.type(await screen.findByRole('combobox'), 'a')
    expect(await screen.findByText('Type at least 2 characters')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('queries and renders results once the term is long enough', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')

    const options = await screen.findAllByRole('option', {}, { timeout: 3000 })
    expect(options).toHaveLength(3)
    expect(screen.getByText('Angkor Classic Discovery')).toBeInTheDocument()

    // The search endpoint must be called with the term, not an unknown param.
    const url = String(fetchMock.mock.calls.at(-1)?.[0])
    expect(url).toContain('/v1/search?')
    expect(url).toContain('q=angkor')
    expect(url).toContain('limit=8')
  })

  it('marks the first result active and moves the highlight with arrow keys', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    const input = await screen.findByRole('combobox')
    await userEvent.type(input, 'angkor')

    const options = await screen.findAllByRole('option', {}, { timeout: 3000 })
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')

    // Wrapping from the last option returns to the first.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('points aria-activedescendant at the highlighted option', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    const input = await screen.findByRole('combobox')
    await userEvent.type(input, 'angkor')

    const options = await screen.findAllByRole('option', {}, { timeout: 3000 })
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id)

    await userEvent.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]!.id)
  })

  it('jumps to the first and last option with Home and End', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')
    await screen.findAllByRole('option', {}, { timeout: 3000 })

    await userEvent.keyboard('{End}')
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Home}')
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('navigates to the highlighted result on Enter, routing by kind', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')
    await screen.findAllByRole('option', {}, { timeout: 3000 })

    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(push).toHaveBeenCalledWith('/hotels/h1')
  })

  it('navigates on click', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')
    await screen.findAllByRole('option', {}, { timeout: 3000 })

    await userEvent.click(screen.getByText('Angkor Wat'))
    expect(push).toHaveBeenCalledWith('/places/p1')
  })

  it('closes and clears the term after navigating', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')
    await screen.findAllByRole('option', {}, { timeout: 3000 })

    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    expect(await screen.findByRole('combobox')).toHaveValue('')
  })

  it('shows an empty state when the search returns nothing', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, limit: 8, totalPages: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'zzzz')

    expect(await screen.findByText(/No results for/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('announces a failed search without exposing the backend message', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'SERVICE_UNAVAILABLE', message: 'redis down' },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await userEvent.type(await screen.findByRole('combobox'), 'angkor')

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert).toHaveTextContent('Search failed')
    expect(alert).not.toHaveTextContent('redis down')
  })
})
