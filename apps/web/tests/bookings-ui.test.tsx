import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingDetailView } from '@/components/bookings/BookingDetailView';
import { BookingsList } from '@/components/bookings/BookingsList';
import { HoldCountdown } from '@/components/bookings/HoldCountdown';
import { formatCountdown } from '@/hooks/use-bookings';
import { translate } from '@/lib/i18n';
import type { Booking } from '@/types/booking';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: (path: string) => getMock(path) as Promise<unknown>,
      post: (path: string, body?: unknown) => postMock(path, body) as Promise<unknown>,
    },
  };
});

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    reference: 'DLG-2026-0042',
    status: 'HOLD',
    startDate: '2027-11-01',
    endDate: '2027-11-03',
    guests: 2,
    totalCents: 37_800,
    currency: 'USD',
    contactName: 'Sok Dara',
    contactEmail: 'sok@example.com',
    packageId: 'pkg-1',
    packageSlug: 'angkor-essentials-3-day',
    draftId: 'draft-1',
    checkInCode: null,
    holdExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    secondsRemaining: 600,
    confirmedAt: null,
    cancelledAt: null,
    snapshot: {
      title: 'Angkor Essentials',
      packageSlug: 'angkor-essentials-3-day',
      days: [
        {
          dayKey: 'dy_1',
          dayNumber: 1,
          title: 'Arrival',
          summary: '',
          items: [
            {
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
            },
          ],
        },
      ],
      price: {
        baseCents: 37_800,
        itemsCents: 7400,
        templateItemsCents: 7400,
        deltaCents: 0,
        totalCents: 37_800,
        currency: 'USD',
        lines: [],
      },
    },
    items: [],
    payment: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('formatCountdown', () => {
  it.each([
    [900, '15:00'],
    [600, '10:00'],
    [61, '1:01'],
    [9, '0:09'],
    [0, '0:00'],
  ])('renders %i seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('HoldCountdown', () => {
  it('renders nothing when there is no hold', () => {
    const { container } = render(<HoldCountdown seconds={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the remaining time politely while there is room to spare', () => {
    render(<HoldCountdown seconds={600} />);

    const status = screen.getByTestId('hold-countdown');
    expect(status).toHaveTextContent('10:00');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('escalates to an assertive warning in the last two minutes', () => {
    render(<HoldCountdown seconds={90} />);

    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('aria-live', 'assertive');
  });

  it('explains what happened once the hold lapses', () => {
    render(<HoldCountdown seconds={0} />);

    expect(screen.getByTestId('hold-countdown')).toHaveTextContent(
      translate('bookings.holdLapsed'),
    );
    expect(screen.getByTestId('hold-countdown')).toHaveTextContent(
      translate('bookings.holdLapsedHint'),
    );
  });
});

describe('BookingsList', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('lists bookings with reference, dates and total', async () => {
    getMock.mockResolvedValue([makeBooking()]);

    renderWithQuery(<BookingsList />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Angkor Essentials');
    });
    expect(screen.getByText(/DLG-2026-0042/)).toBeInTheDocument();
    expect(screen.getByText('$378')).toBeInTheDocument();
    expect(screen.getByTestId('booking-status')).toHaveTextContent(
      translate('bookings.statusHOLD'),
    );
  });

  it('shows the live countdown only for bookings that hold inventory', async () => {
    getMock.mockResolvedValue([
      makeBooking(),
      makeBooking({
        id: 'booking-2',
        reference: 'DLG-2026-0043',
        status: 'CONFIRMED',
        holdExpiresAt: null,
        secondsRemaining: null,
        checkInCode: 'A1B2C3D4',
      }),
    ]);

    renderWithQuery(<BookingsList />);

    await waitFor(() => {
      expect(screen.getAllByTestId('booking-status')).toHaveLength(2);
    });
    // Only the held booking gets a countdown.
    expect(screen.getAllByTestId('hold-countdown')).toHaveLength(1);
  });

  it('offers a way forward when there is nothing booked yet', async () => {
    getMock.mockResolvedValue([]);

    renderWithQuery(<BookingsList />);

    await waitFor(() => {
      expect(screen.getByText(translate('bookings.empty'))).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: translate('bookings.browseCta') })).toHaveAttribute(
      'href',
      '/packages',
    );
  });

  it('reports a load failure', async () => {
    getMock.mockRejectedValue(new Error('offline'));

    renderWithQuery(<BookingsList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(translate('bookings.loadError'));
    });
  });
});

describe('BookingDetailView', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('shows the frozen itinerary and total', async () => {
    getMock.mockResolvedValue(makeBooking());

    renderWithQuery(<BookingDetailView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Angkor Essentials');
    });
    expect(screen.getByTestId('booking-total')).toHaveTextContent('$378');
    expect(screen.getByText('Angkor Wat')).toBeInTheDocument();
    expect(screen.getByText('Day 1 — Arrival')).toBeInTheDocument();
  });

  it('offers payment and cancellation while the hold is warm', async () => {
    getMock.mockResolvedValue(makeBooking());

    renderWithQuery(<BookingDetailView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: translate('bookings.payNow') })).toHaveAttribute(
        'href',
        '/checkout/booking-1',
      );
    });
    expect(
      screen.getByRole('button', { name: translate('bookings.cancelBooking') }),
    ).toBeInTheDocument();
  });

  it('shows the check-in code once confirmed and hides the pay button', async () => {
    getMock.mockResolvedValue(
      makeBooking({
        status: 'CONFIRMED',
        checkInCode: 'A1B2C3D4',
        holdExpiresAt: null,
        secondsRemaining: null,
        confirmedAt: '2026-08-01T00:05:00.000Z',
      }),
    );

    renderWithQuery(<BookingDetailView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('check-in-code')).toHaveTextContent('A1B2C3D4');
    });
    expect(screen.queryByRole('link', { name: translate('bookings.payNow') })).not.toBeInTheDocument();
    expect(screen.queryByTestId('hold-countdown')).not.toBeInTheDocument();
  });

  it('asks for confirmation before cancelling, then calls the API', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(makeBooking({ status: 'CANCELLED', holdExpiresAt: null, secondsRemaining: null }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    renderWithQuery(<BookingDetailView bookingId="booking-1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: translate('bookings.cancelBooking') })).toBeEnabled(),
    );

    await user.click(screen.getByRole('button', { name: translate('bookings.cancelBooking') }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: translate('bookings.cancelBooking') }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/bookings/booking-1/cancel', undefined);
    });
  });

  it('hides both actions for an expired booking', async () => {
    getMock.mockResolvedValue(
      makeBooking({ status: 'EXPIRED', holdExpiresAt: null, secondsRemaining: null }),
    );

    renderWithQuery(<BookingDetailView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('booking-status')).toHaveTextContent(
        translate('bookings.statusEXPIRED'),
      );
    });
    expect(screen.queryByRole('link', { name: translate('bookings.payNow') })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: translate('bookings.cancelBooking') }),
    ).not.toBeInTheDocument();
  });

  it('explains a missing booking instead of rendering a broken page', async () => {
    getMock.mockRejectedValue(new Error('404'));

    renderWithQuery(<BookingDetailView bookingId="ghost" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(translate('bookings.notFound'));
    });
  });
});
