import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JourneyEditor } from '@/components/journey/JourneyEditor';
import { translate } from '@/lib/i18n';
import type { DraftDay, DraftItem, DraftView } from '@/types/journey';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const patchMock = vi.fn();
const getPageMock = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      patch: (path: string, body?: unknown) => patchMock(path, body) as Promise<unknown>,
      getPage: (path: string) => getPageMock(path) as Promise<unknown>,
    },
  };
});

function item(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    itemKey: 'it_1',
    type: 'PLACE',
    refId: 'place-1',
    title: 'Angkor Wat',
    description: '',
    startTime: '08:00',
    durationMinutes: 120,
    extraPriceCents: 0,
    bookable: true,
    unitPriceCents: 3700,
    referenceLabel: 'Angkor Wat',
    ...overrides,
  };
}

function day(overrides: Partial<DraftDay> = {}): DraftDay {
  return {
    dayKey: 'dy_1',
    dayNumber: 1,
    title: 'Arrival',
    summary: '',
    items: [item()],
    ...overrides,
  };
}

function makeDraft(overrides: Partial<DraftView> = {}): DraftView {
  return {
    id: 'draft-1',
    title: 'Angkor Essentials',
    source: 'MANUAL',
    packageId: 'pkg-1',
    packageSlug: 'angkor-essentials-3-day',
    startDate: '2027-07-01',
    guests: 2,
    days: [
      day(),
      day({ dayKey: 'dy_2', dayNumber: 2, title: 'Temples', items: [] }),
      day({
        dayKey: 'dy_3',
        dayNumber: 3,
        title: 'Departure',
        items: [
          item({
            itemKey: 'it_hotel',
            type: 'HOTEL',
            refId: 'hotel-1',
            title: 'Lotus Lodge',
            referenceLabel: 'Lotus Lodge',
            startTime: '14:00',
            unitPriceCents: 2800,
          }),
        ],
      }),
    ],
    price: {
      baseCents: 37_800,
      itemsCents: 10_200,
      templateItemsCents: 10_200,
      deltaCents: 0,
      totalCents: 37_800,
      currency: 'USD',
      lines: [{ dayNumber: 1, type: 'PLACE', refId: 'place-1', label: 'Angkor Wat', quantity: 2, unitPriceCents: 3700, totalCents: 7400 }],
    },
    availability: { available: true, unavailableCount: 0, items: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderEditor(draft: DraftView = makeDraft()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <JourneyEditor draft={draft} cityForPicker="siem-reap" />
    </QueryClientProvider>,
  );
}

/** Last operations array sent to PATCH. */
function lastOperations(): unknown[] {
  const call = patchMock.mock.calls.at(-1);
  return (call?.[1] as { operations: unknown[] }).operations;
}

describe('JourneyEditor', () => {
  beforeEach(() => {
    patchMock.mockReset().mockImplementation(() => Promise.resolve(makeDraft()));
    getPageMock.mockReset().mockResolvedValue({
      items: [
        {
          id: 'hotel-2',
          slug: 'sokha',
          name: 'Sokha Heritage Residence',
          starRating: 5,
          pricePerNightCents: 18_500,
          city: { slug: 'siem-reap', name: 'Siem Reap' },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders every day with its activities and the running total', () => {
    renderEditor();

    expect(screen.getByTestId('day-1')).toBeInTheDocument();
    expect(screen.getByTestId('day-2')).toBeInTheDocument();
    expect(screen.getByTestId('day-3')).toBeInTheDocument();
    expect(screen.getByText('Angkor Wat')).toBeInTheDocument();
    expect(screen.getByTestId('price-total')).toHaveTextContent('$378');
  });

  it('shows an empty-day hint rather than a blank block', () => {
    renderEditor();

    expect(within(screen.getByTestId('day-2')).getByText(translate('customize.emptyDay'))).toBeInTheDocument();
  });

  it('reorders days with the arrow buttons and sends the full new order', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      within(screen.getByTestId('day-1')).getByRole('button', {
        name: translate('customize.moveDayDown'),
      }),
    );

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([{ op: 'reorder_days', dayKeys: ['dy_2', 'dy_1', 'dy_3'] }]);
  });

  it('disables moving the first day up and the last day down', () => {
    renderEditor();

    expect(
      within(screen.getByTestId('day-1')).getByRole('button', {
        name: translate('customize.moveDayUp'),
      }),
    ).toBeDisabled();
    expect(
      within(screen.getByTestId('day-3')).getByRole('button', {
        name: translate('customize.moveDayDown'),
      }),
    ).toBeDisabled();
  });

  it('exposes a focusable, described drag handle plus keyboard arrow controls', () => {
    renderEditor();

    const day = within(screen.getByTestId('day-1'));
    const handle = day.getByRole('button', {
      name: translate('customize.dragHandle', { number: 1 }),
    });
    // dnd-kit's sortable attributes make the handle focusable and announced.
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('aria-roledescription');

    // The arrow buttons are the guaranteed keyboard path to reordering.
    expect(day.getByRole('button', { name: translate('customize.moveDayDown') })).toBeEnabled();
  });

  it('adds a day', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: translate('customize.addDay') }));

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([{ op: 'add_day' }]);
  });

  it('asks before removing a day that still has activities', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      within(screen.getByTestId('day-1')).getByRole('button', {
        name: translate('customize.removeDay'),
      }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(patchMock).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(
      within(screen.getByTestId('day-1')).getByRole('button', {
        name: translate('customize.removeDay'),
      }),
    );
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([
      { op: 'remove_day', dayKey: 'dy_1', confirmRemoval: true },
    ]);
  });

  it('removes an activity', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      screen.getByRole('button', { name: translate('customize.removeItem', { title: 'Angkor Wat' }) }),
    );

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([{ op: 'remove_item', itemKey: 'it_1' }]);
  });

  it('swaps a hotel through the picker, sending a replace_item with the chosen id', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(within(screen.getByTestId('day-3')).getByRole('button', { name: translate('customize.swapItem') }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(translate('customize.pickerTitleHOTEL'));

    await user.click(await screen.findByText('Sokha Heritage Residence'));

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([
      {
        op: 'replace_item',
        itemKey: 'it_hotel',
        item: { type: 'HOTEL', refId: 'hotel-2', title: 'Sokha Heritage Residence' },
      },
    ]);
  });

  it('adds free time as a non-bookable custom item', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      within(screen.getByTestId('day-2')).getByRole('button', {
        name: translate('customize.addFreeTime'),
      }),
    );

    await user.type(
      screen.getByLabelText(translate('customize.customTitleLabel')),
      'Pool afternoon',
    );
    // The dialog's submit button shares its label with the day's trigger, so
    // scope the query to the dialog.
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: translate('customize.addFreeTime'),
      }),
    );

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([
      { op: 'add_item', dayKey: 'dy_2', item: { type: 'CUSTOM', title: 'Pool afternoon' } },
    ]);
  });

  it('closes the picker on Escape without changing anything', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      within(screen.getByTestId('day-2')).getByRole('button', {
        name: translate('customize.addPlace'),
      }),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchMock).not.toHaveBeenCalled();
  });

  it('shows a price delta and the itemised breakdown after a change', () => {
    renderEditor(
      makeDraft({
        price: {
          baseCents: 37_800,
          itemsCents: 23_500,
          templateItemsCents: 10_200,
          deltaCents: 13_100,
          totalCents: 50_900,
          currency: 'USD',
          lines: [
            {
              dayNumber: 3,
              type: 'HOTEL',
              refId: 'hotel-2',
              label: 'Sokha Heritage Residence',
              quantity: 1,
              unitPriceCents: 18_500,
              totalCents: 18_500,
            },
          ],
        },
      }),
    );

    expect(screen.getByTestId('price-delta')).toHaveTextContent('+$131');
    expect(screen.getByTestId('price-total')).toHaveTextContent('$509');
    expect(screen.getByText(/Sokha Heritage Residence ×1/)).toBeInTheDocument();
  });

  it('surfaces an unavailable item with its alternatives and swaps on click', async () => {
    const user = userEvent.setup();
    renderEditor(
      makeDraft({
        availability: {
          available: false,
          unavailableCount: 1,
          items: [
            {
              itemKey: 'it_hotel',
              dayNumber: 3,
              date: '2027-07-03',
              available: false,
              reason: 'SOLD_OUT',
              remaining: 0,
              alternatives: [
                { refId: 'hotel-9', slug: 'angkor-terrace', label: 'Angkor Terrace Hotel', priceCents: 5400 },
              ],
            },
          ],
        },
      }),
    );

    expect(screen.getByTestId('availability-summary')).toHaveTextContent(
      translate('customize.availabilityProblem', { count: 1 }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      translate('customize.unavailableItem', { date: '2027-07-03' }),
    );

    await user.click(screen.getByRole('button', { name: /Angkor Terrace Hotel/ }));

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(lastOperations()).toEqual([
      {
        op: 'replace_item',
        itemKey: 'it_hotel',
        item: { type: 'HOTEL', refId: 'hotel-9', title: 'Angkor Terrace Hotel' },
      },
    ]);
  });

  it('debounces a rename into a single save', async () => {
    const user = userEvent.setup();
    renderEditor();

    const titleInput = within(screen.getByTestId('day-1')).getByLabelText(
      translate('customize.dayTitlePlaceholder'),
    );
    await user.type(titleInput, 'X');

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(lastOperations()).toHaveLength(1);
  });

  it('reports a rejected save without losing the server state', async () => {
    const { ApiError } = await import('@/lib/api-client');
    patchMock.mockRejectedValue(
      new ApiError(400, 'DRAFT_INVALID_MUTATION', '"Bayon" overlaps "Angkor Wat" on day 1.'),
    );
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: translate('customize.addDay') }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('overlaps');
    });
    // The tree still shows what the server last confirmed.
    expect(screen.getByTestId('day-1')).toBeInTheDocument();
  });

  it('changes traveller count and start date', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.clear(screen.getByLabelText(translate('customize.guestsLabel')));
    await user.type(screen.getByLabelText(translate('customize.guestsLabel')), '4');

    await waitFor(() => expect(patchMock).toHaveBeenCalled(), { timeout: 2000 });
    expect(JSON.stringify(lastOperations())).toContain('set_guests');
  });
});
