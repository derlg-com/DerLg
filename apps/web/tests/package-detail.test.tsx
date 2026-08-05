import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PackageDetailView } from '@/components/catalog/PackageDetailView';
import { translate } from '@/lib/i18n';
import type { PackageDetail, PlaceSummary } from '@/types/catalog';

function place(name: string, slug: string, feeCents = 0): PlaceSummary {
  return {
    id: `place-${slug}`,
    slug,
    name,
    category: 'TEMPLE',
    latitude: 13.4,
    longitude: 103.8,
    entranceFeeCents: feeCents,
    visitDurationMinutes: 90,
    dailyCapacity: 400,
    city: { slug: 'siem-reap', name: 'Siem Reap' },
    images: [
      {
        url: `/seed/siem-reap/${slug}/1.jpg`,
        position: 0,
        author: 'Marcin Konsek',
        license: 'CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
      },
    ],
  };
}

const pkg: PackageDetail = {
  id: 'pkg-1',
  slug: 'private-family-angkor-4-day',
  title: 'Private Family Angkor',
  summary: 'A four-day private journey shaped around younger travellers.',
  kind: 'PRIVATE',
  pricingMode: 'PER_GROUP',
  durationDays: 2,
  basePriceCents: 128_000,
  minGroupSize: 2,
  maxGroupSize: 8,
  kidFriendly: true,
  featured: true,
  heroImageUrl: '/seed/siem-reap/bayon-temple/1.jpg',
  highlights: ['Private guide', 'Temple mornings, pool afternoons'],
  city: {
    id: 'c1',
    slug: 'siem-reap',
    name: 'Siem Reap',
    country: 'Cambodia',
    latitude: 13.3,
    longitude: 103.8,
  },
  inclusions: ['Three nights accommodation', 'Private guide'],
  exclusions: ['Flights', 'Insurance'],
  days: [
    {
      id: 'day-1',
      dayNumber: 1,
      title: 'Settle in slowly',
      summary: 'Arrive, swim, and take a gentle first look at the town.',
      items: [
        {
          id: 'item-1',
          position: 0,
          type: 'PLACE',
          refId: 'place-angkor-wat',
          title: 'Angkor Wat at first light',
          description: '',
          startTime: '05:30',
          durationMinutes: 120,
          priceCents: 0,
          bookable: true,
          reference: { kind: 'PLACE', place: place('Angkor Wat', 'angkor-wat', 3700) },
        },
      ],
    },
    {
      id: 'day-2',
      dayNumber: 2,
      title: 'Water day',
      summary: 'A boat through the flooded forest.',
      items: [
        {
          id: 'item-2',
          position: 0,
          type: 'CUSTOM',
          refId: null,
          title: 'Pool afternoon and nap',
          description: 'Nothing scheduled. This is deliberate.',
          startTime: '13:00',
          durationMinutes: 240,
          priceCents: 0,
          bookable: false,
          reference: null,
        },
      ],
    },
  ],
};

describe('PackageDetailView', () => {
  it('renders the headline, price and group size', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Private Family Angkor');
    expect(screen.getByText('$1,280')).toBeInTheDocument();
    expect(screen.getByText(translate('packageDetail.perGroup'))).toBeInTheDocument();
    expect(screen.getByText('2–8 travellers')).toBeInTheDocument();
    expect(screen.getByText(translate('packages.kindPrivate'))).toBeInTheDocument();
  });

  it('offers all three next steps: book, customize and ask the AI', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByRole('link', { name: translate('packageDetail.bookAsIs') })).toHaveAttribute(
      'href',
      '/packages/private-family-angkor-4-day/book',
    );
    expect(
      screen.getByRole('link', { name: translate('packageDetail.customize') }),
    ).toHaveAttribute('href', '/packages/private-family-angkor-4-day/customize');
    expect(screen.getByRole('link', { name: translate('packageDetail.askAi') })).toHaveAttribute(
      'href',
      '/vibe?package=private-family-angkor-4-day',
    );
  });

  it('lists every day in order with its items', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByText(translate('packageDetail.dayLabel', { number: 1 }))).toBeInTheDocument();
    expect(screen.getByText(translate('packageDetail.dayLabel', { number: 2 }))).toBeInTheDocument();
    expect(screen.getByText('Angkor Wat at first light')).toBeInTheDocument();
    expect(screen.getByText('05:30')).toBeInTheDocument();
  });

  it('marks a non-bookable free-time item so nobody expects to pay for it', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByText('Pool afternoon and nap')).toBeInTheDocument();
    expect(screen.getByText(translate('packageDetail.nonBookableNote'))).toBeInTheDocument();
  });

  it('shows the entrance fee of a referenced place', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByText('$37')).toBeInTheDocument();
  });

  it('keeps image licence attribution visible in the gallery', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(
      screen.getByText(/Marcin Konsek \(CC BY-SA 4\.0\)/),
    ).toBeInTheDocument();
  });

  it('renders inclusions and exclusions separately', () => {
    render(<PackageDetailView pkg={pkg} />);

    expect(screen.getByText(translate('packageDetail.included'))).toBeInTheDocument();
    expect(screen.getByText('Three nights accommodation')).toBeInTheDocument();
    expect(screen.getByText(translate('packageDetail.excluded'))).toBeInTheDocument();
    expect(screen.getByText('Flights')).toBeInTheDocument();
    // "Private guide" appears in both highlights and inclusions.
    expect(screen.getAllByText('Private guide')).toHaveLength(2);
  });
});
