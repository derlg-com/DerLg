import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutView } from '@/components/checkout/CheckoutView';
import { ConfirmationView } from '@/components/checkout/ConfirmationView';
import { translate } from '@/lib/i18n';
import type { Booking } from '@/types/booking';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Stripe Elements is replaced wholesale: these tests cover DerLg's own flow, and
// a real card field cannot render in jsdom.
const confirmPayment = vi.fn();
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
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
    startDate: '2028-06-01',
    endDate: '2028-06-03',
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
      days: [],
      price: {
        baseCents: 37_800,
        itemsCents: 0,
        templateItemsCents: 0,
        deltaCents: 0,
        totalCents: 37_800,
        currency: 'USD',
        lines: [
          {
            dayNumber: 1,
            type: 'PLACE',
            refId: 'p1',
            label: 'Angkor Wat',
            quantity: 2,
            unitPriceCents: 3700,
            totalCents: 7400,
          },
        ],
      },
    },
    items: [],
    payment: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const intentResponse = {
  paymentId: 'payment-1',
  clientSecret: 'pi_1_secret_abc',
  amountCents: 37_800,
  currency: 'USD',
  bookingReference: 'DLG-2026-0042',
  publishableKey: 'pk_test_123',
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CheckoutView', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    confirmPayment.mockReset();
    push.mockReset();
  });

  it('shows the amount from the booking and mounts the Stripe card field', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(intentResponse);

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    });
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('$378');
    expect(postMock).toHaveBeenCalledWith('/payments/booking-1/intent', undefined);
  });

  it('labels the pay button with the amount the server quoted', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(intentResponse);

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('pay-button')).toHaveTextContent(
        translate('checkout.payButton', { amount: '$378' }),
      );
    });
  });

  it('shows the live hold countdown while paying', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(intentResponse);

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('hold-countdown')).toHaveTextContent('10:00');
    });
  });

  it('confirms the payment with Stripe and moves to the confirmation page', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(intentResponse);
    confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    const user = userEvent.setup();

    renderWithQuery(<CheckoutView bookingId="booking-1" />);
    await waitFor(() => expect(screen.getByTestId('pay-button')).toBeEnabled());

    await user.click(screen.getByTestId('pay-button'));

    await waitFor(() => {
      expect(confirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({ redirect: 'if_required' }),
      );
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/checkout/booking-1/confirmation'),
    );
  });

  it('surfaces a card decline without leaving the page', async () => {
    getMock.mockResolvedValue(makeBooking());
    postMock.mockResolvedValue(intentResponse);
    confirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });
    const user = userEvent.setup();

    renderWithQuery(<CheckoutView bookingId="booking-1" />);
    await waitFor(() => expect(screen.getByTestId('pay-button')).toBeEnabled());

    await user.click(screen.getByTestId('pay-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined.');
    });
    expect(push).not.toHaveBeenCalled();
    // The form is still there so another card can be tried.
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('explains that payments are unconfigured when the API returns 503', async () => {
    const { ApiError } = await import('@/lib/api-client');
    getMock.mockResolvedValue(makeBooking());
    postMock.mockRejectedValue(
      new ApiError(503, 'PAYMENT_FAILED', 'Card payments are not configured on this environment yet.'),
    );

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(translate('checkout.notConfigured'));
    });
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
  });

  it('does not offer payment for an expired hold', async () => {
    getMock.mockResolvedValue(
      makeBooking({ status: 'EXPIRED', holdExpiresAt: null, secondsRemaining: null }),
    );

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(translate('checkout.expired'));
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does not charge twice for an already-confirmed booking', async () => {
    getMock.mockResolvedValue(
      makeBooking({ status: 'CONFIRMED', checkInCode: 'A1B2C3D4', holdExpiresAt: null, secondsRemaining: null }),
    );

    renderWithQuery(<CheckoutView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByText(translate('checkout.alreadyPaid'))).toBeInTheDocument();
    });
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('ConfirmationView', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('shows the reference, check-in code and total once confirmed', async () => {
    getMock.mockResolvedValue(
      makeBooking({
        status: 'CONFIRMED',
        checkInCode: 'A1B2C3D4',
        holdExpiresAt: null,
        secondsRemaining: null,
        confirmedAt: '2026-08-01T00:05:00.000Z',
      }),
    );

    renderWithQuery(<ConfirmationView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-reference')).toHaveTextContent('DLG-2026-0042');
    });
    expect(screen.getByTestId('confirmation-check-in')).toHaveTextContent('A1B2C3D4');
    expect(screen.getByText('$378')).toBeInTheDocument();
    expect(screen.getByText(/sok@example.com/)).toBeInTheDocument();
  });

  it('offers a downloadable receipt and calendar file', async () => {
    getMock.mockResolvedValue(
      makeBooking({ status: 'CONFIRMED', checkInCode: 'A1B2C3D4', holdExpiresAt: null, secondsRemaining: null }),
    );

    renderWithQuery(<ConfirmationView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: translate('checkout.downloadReceipt') })).toBeInTheDocument();
    });

    const receipt = screen.getByRole('link', { name: translate('checkout.downloadReceipt') });
    expect(receipt).toHaveAttribute('download', 'derlg-receipt-DLG-2026-0042.txt');
    expect(receipt.getAttribute('href')).toContain('DLG-2026-0042');

    const calendar = screen.getByRole('link', { name: translate('checkout.addToCalendar') });
    expect(calendar).toHaveAttribute('download', 'derlg-DLG-2026-0042.ics');
    expect(decodeURIComponent(calendar.getAttribute('href') ?? '')).toContain('BEGIN:VCALENDAR');
    expect(decodeURIComponent(calendar.getAttribute('href') ?? '')).toContain('DTSTART;VALUE=DATE:20280601');
  });

  it('waits politely while the webhook is still in flight', async () => {
    getMock.mockResolvedValue(makeBooking({ status: 'PENDING_PAYMENT' }));

    renderWithQuery(<ConfirmationView bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('awaiting-confirmation')).toHaveTextContent(
        translate('checkout.waitingForConfirmation'),
      );
    });
    expect(screen.queryByTestId('confirmation-check-in')).not.toBeInTheDocument();
  });
});
