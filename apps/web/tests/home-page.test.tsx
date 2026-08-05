import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiStatusBadge } from '@/components/shared/ApiStatusBadge';
import { translate } from '@/lib/i18n';
import type { PackageSummary } from '@/types/catalog';

const fetchPublic = vi.fn();
vi.mock('@/lib/server-api', () => ({
  fetchPublic: (path: string) => fetchPublic(path) as Promise<unknown>,
}));

const featured: PackageSummary[] = [
  {
    id: 'pkg-1',
    slug: 'angkor-essentials-3-day',
    title: 'Angkor Essentials',
    summary: 'Three days built around the temples that matter.',
    kind: 'PUBLIC',
    pricingMode: 'PER_PERSON',
    durationDays: 3,
    basePriceCents: 18_900,
    minGroupSize: 1,
    maxGroupSize: 16,
    kidFriendly: true,
    featured: true,
    heroImageUrl: '/seed/siem-reap/angkor-wat/1.jpg',
    highlights: [],
    city: { slug: 'siem-reap', name: 'Siem Reap' },
  },
];

/** Server components are plain async functions; await them, then render the tree. */
async function renderHomePage() {
  const { default: HomePage } = await import('@/app/(public)/page');
  const ui = await HomePage();
  return render(ui);
}

describe('HomePage', () => {
  beforeEach(() => {
    fetchPublic.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ data: { status: 'ok' } }) }),
    );
  });

  it('renders the hero copy and both entry points', async () => {
    fetchPublic.mockResolvedValue(featured);

    await renderHomePage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      translate('home.heroTitle'),
    );
    expect(screen.getByRole('link', { name: translate('home.heroPrimaryCta') })).toHaveAttribute(
      'href',
      '/vibe',
    );
    expect(screen.getByRole('link', { name: translate('home.heroSecondaryCta') })).toHaveAttribute(
      'href',
      '/packages',
    );
  });

  it('lists featured packages fetched on the server', async () => {
    fetchPublic.mockResolvedValue(featured);

    await renderHomePage();

    expect(fetchPublic).toHaveBeenCalledWith('/packages?featured=true&limit=3');
    expect(screen.getByText(translate('home.featuredTitle'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Angkor Essentials' })).toBeInTheDocument();
    expect(screen.getByText('$189')).toBeInTheDocument();
  });

  it('degrades to the hero and explainer when the catalogue is unavailable', async () => {
    fetchPublic.mockRejectedValue(new Error('catalogue down'));

    await renderHomePage();

    // No crash, no error page: the marketing content still renders.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(translate('home.featuredTitle'))).not.toBeInTheDocument();
    expect(screen.getByText(translate('home.howAiTitle'))).toBeInTheDocument();
  });
});

describe('ApiStatusBadge', () => {
  it('reports healthy services', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ data: { status: 'ok' } }) }),
    );

    render(<ApiStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('api-status')).toHaveTextContent(translate('home.statusOk'));
    });
  });

  it('reports a degraded API when a dependency is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ data: { status: 'degraded' } }) }),
    );

    render(<ApiStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('api-status')).toHaveTextContent(translate('home.statusDegraded'));
    });
  });

  it('reports an unreachable API when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<ApiStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('api-status')).toHaveTextContent(
        translate('home.statusUnreachable'),
      );
    });
  });
});
