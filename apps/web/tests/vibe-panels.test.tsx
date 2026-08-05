import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContentStagePanel } from '@/components/vibe/ContentStagePanel';
import type { VibePanel } from '@/types/vibe';

function panel(stage: VibePanel['stage'], payload: unknown): VibePanel {
  return { id: 'p1', stage, payload };
}

describe('ContentStagePanel', () => {
  describe('search results', () => {
    it('renders places with their entrance fees, and free ones as free', () => {
      render(
        <ContentStagePanel
          panel={panel('places', {
            total: 2,
            items: [
              { refId: 'p1', name: 'Angkor Wat', city: 'Siem Reap', category: 'TEMPLE', entranceFeeUsd: 37 },
              { refId: 'p2', name: 'Old Market', city: 'Siem Reap', category: 'MARKET', entranceFeeUsd: 0 },
            ],
          })}
        />,
      );

      expect(screen.getByText('Angkor Wat')).toBeInTheDocument();
      expect(screen.getByText('$37')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('2 options')).toBeInTheDocument();
    });

    it('renders hotels with nightly prices and amenities', () => {
      render(
        <ContentStagePanel
          panel={panel('hotels', {
            items: [
              {
                refId: 'h1',
                name: 'Lotus Lodge',
                city: 'Siem Reap',
                stars: 2,
                pricePerNightUsd: 28,
                amenities: ['Free Wi-Fi', 'Pool'],
              },
            ],
          })}
        />,
      );

      expect(screen.getByText('Lotus Lodge')).toBeInTheDocument();
      expect(screen.getByText('$28')).toBeInTheDocument();
      expect(screen.getByText('Free Wi-Fi · Pool')).toBeInTheDocument();
      expect(screen.getByText(/2-star/)).toBeInTheDocument();
    });

    it('renders a transport route', () => {
      render(
        <ContentStagePanel
          panel={panel('transport', {
            items: [
              {
                refId: 't1',
                operator: 'Giant Ibis',
                kind: 'BUS',
                from: 'Phnom Penh',
                to: 'Siem Reap',
                departureTime: '08:00',
                pricePerSeatUsd: 15,
              },
            ],
          })}
        />,
      );

      expect(screen.getByText('Giant Ibis')).toBeInTheDocument();
      expect(screen.getByText(/Phnom Penh → Siem Reap/)).toBeInTheDocument();
      expect(screen.getByText('$15')).toBeInTheDocument();
    });

    it('renders a guide with the languages they speak', () => {
      render(
        <ContentStagePanel
          panel={panel('guides', {
            items: [
              {
                refId: 'g1',
                name: 'Sokha Chan',
                city: 'Siem Reap',
                languages: ['English', 'Mandarin'],
                pricePerDayUsd: 45,
                yearsExperience: 8,
              },
            ],
          })}
        />,
      );

      expect(screen.getByText('Sokha Chan')).toBeInTheDocument();
      expect(screen.getByText(/English, Mandarin/)).toBeInTheDocument();
      expect(screen.getByText('$45')).toBeInTheDocument();
    });

    it('links a package to its own page', () => {
      render(
        <ContentStagePanel
          panel={panel('packages', {
            items: [
              {
                packageId: 'k1',
                slug: 'angkor-essentials-3-day',
                title: 'Angkor Essentials',
                city: 'Siem Reap',
                days: 3,
                priceUsd: 189,
                summary: 'The classic three days.',
              },
            ],
          })}
        />,
      );

      expect(screen.getByRole('link', { name: /see the full trip/i })).toHaveAttribute(
        'href',
        '/packages/angkor-essentials-3-day',
      );
      expect(screen.getByText('$189')).toBeInTheDocument();
    });

    it('says so plainly when a search found nothing', () => {
      render(<ContentStagePanel panel={panel('hotels', { total: 0, items: [] })} />);

      expect(screen.getByText(/no hotels matched/i)).toBeInTheDocument();
    });
  });

  describe('availability', () => {
    it('confirms when everything is available', () => {
      render(
        <ContentStagePanel
          panel={panel('availability', { available: true, totalUsd: 102, items: [] })}
        />,
      );

      expect(screen.getByText(/everything is available/i)).toBeInTheDocument();
      expect(screen.getByText('Total $102')).toBeInTheDocument();
    });

    it('names what is unavailable and what could replace it', () => {
      render(
        <ContentStagePanel
          panel={panel('availability', {
            available: false,
            items: [
              {
                dayNumber: 2,
                type: 'HOTEL',
                refId: 'h1',
                available: false,
                reason: 'SOLD_OUT',
                alternatives: [{ refId: 'h2', name: 'Angkor Terrace', priceUsd: 54 }],
              },
            ],
          })}
        />,
      );

      expect(screen.getByText(/some things are not available/i)).toBeInTheDocument();
      expect(screen.getByText(/sold out/i)).toBeInTheDocument();
      expect(screen.getByText(/Angkor Terrace/)).toBeInTheDocument();
    });
  });

  describe('itinerary', () => {
    const itinerary = {
      draftId: 'draft-77',
      title: 'Three days around Angkor',
      startDate: '2029-05-10',
      guests: 2,
      totalUsd: 102,
      currency: 'USD',
      days: [
        {
          dayNumber: 1,
          title: 'Temples at dawn',
          summary: 'An early start.',
          items: [
            {
              type: 'PLACE',
              refId: 'p1',
              title: 'Angkor Wat at sunrise',
              startTime: '05:00',
              bookable: true,
              name: 'Angkor Wat',
              unitPriceUsd: 37,
            },
            { type: 'CUSTOM', refId: null, title: 'Free afternoon', bookable: false },
          ],
        },
      ],
    };

    it('shows the days, the server´s total, and the resolved catalogue names', () => {
      render(<ContentStagePanel panel={panel('itinerary', itinerary)} />);

      expect(screen.getByText('Three days around Angkor')).toBeInTheDocument();
      expect(screen.getByText('Temples at dawn')).toBeInTheDocument();
      // The real catalogue name, not the model's phrasing.
      expect(screen.getByText(/Angkor Wat$/)).toBeInTheDocument();
      expect(screen.getByTestId('vibe-itinerary-total')).toHaveTextContent('$102');
      expect(screen.getByText(/2 travellers/)).toBeInTheDocument();
    });

    it('marks an invented item as free time with nothing booked', () => {
      render(<ContentStagePanel panel={panel('itinerary', itinerary)} />);

      expect(screen.getByText(/free time, nothing booked/i)).toBeInTheDocument();
    });

    it('offers both the manual editor and the booking path', () => {
      render(<ContentStagePanel panel={panel('itinerary', itinerary)} />);

      expect(screen.getByRole('link', { name: /edit this trip myself/i })).toHaveAttribute(
        'href',
        '/journeys/draft-77',
      );
      expect(screen.getByRole('link', { name: /hold and pay/i })).toHaveAttribute(
        'href',
        '/checkout/new?draft=draft-77',
      );
    });

    it('warns when the plan cannot be booked as it stands', () => {
      render(
        <ContentStagePanel
          panel={panel('itinerary', {
            ...itinerary,
            availability: { available: false, unavailable: [{ dayNumber: 1, reason: 'SOLD_OUT' }] },
          })}
        />,
      );

      expect(screen.getByText(/need changing before this can be booked/i)).toBeInTheDocument();
    });
  });

  describe('booking', () => {
    const booking = {
      bookingId: 'bk-9',
      reference: 'DLG-2026-0004',
      status: 'HOLD',
      totalUsd: 102,
      holdExpiresAt: '2029-05-10T00:15:00.000Z',
      secondsRemaining: 880,
      guests: 2,
      startDate: '2029-05-10',
    };

    it('shows the reference, the amount and the countdown', () => {
      render(<ContentStagePanel panel={panel('booking', booking)} />);

      expect(screen.getByText('DLG-2026-0004')).toBeInTheDocument();
      expect(screen.getByText('$102')).toBeInTheDocument();
      expect(screen.getByText(/14:40/)).toBeInTheDocument();
    });

    it('is explicit that nothing has been charged yet', () => {
      render(<ContentStagePanel panel={panel('booking', booking)} />);

      expect(screen.getByText(/nothing has been charged yet/i)).toBeInTheDocument();
    });

    it('builds the checkout link from the booking id, not from a supplied url', () => {
      render(<ContentStagePanel panel={panel('booking', booking)} />);

      expect(screen.getByRole('link', { name: /pay now/i })).toHaveAttribute(
        'href',
        '/checkout/bk-9',
      );
    });
  });

  describe('degrading safely', () => {
    it('falls back to a summary when the payload shape is wrong', () => {
      // A drifted contract must not throw inside a render and blank the chat.
      render(<ContentStagePanel panel={panel('hotels', { items: 'not an array' })} />);

      expect(screen.getByText(/see the message beside this panel/i)).toBeInTheDocument();
    });

    it('falls back for a stage this build does not know', () => {
      render(
        <ContentStagePanel
          panel={{ id: 'p1', stage: 'weather' as VibePanel['stage'], payload: { items: [1, 2] } }}
        />,
      );

      expect(screen.getByText('weather')).toBeInTheDocument();
      expect(screen.getByText(/2 results/i)).toBeInTheDocument();
    });

    it('renders text_summary without pretending to draw cards', () => {
      render(<ContentStagePanel panel={panel('text_summary', { note: 'anything' })} />);

      expect(screen.getByText('text summary')).toBeInTheDocument();
    });
  });
});
