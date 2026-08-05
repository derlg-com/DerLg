import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PackageBrowser } from '@/components/catalog/PackageBrowser';
import { PackageCard } from '@/components/catalog/PackageCard';
import { packageFiltersToQuery } from '@/hooks/use-catalog';
import { translate } from '@/lib/i18n';
import type { City, PackageSummary } from '@/types/catalog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const getPage = vi.fn();
const get = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: (path: string) => get(path) as Promise<unknown>,
      getPage: (path: string) => getPage(path) as Promise<unknown>,
    },
  };
});

function makePackage(overrides: Partial<PackageSummary> = {}): PackageSummary {
  return {
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
    highlights: ['Sunrise at Angkor Wat'],
    city: { slug: 'siem-reap', name: 'Siem Reap' },
    ...overrides,
  };
}

const cities: City[] = [
  { id: 'c1', slug: 'siem-reap', name: 'Siem Reap', country: 'Cambodia', latitude: 13.3, longitude: 103.8 },
  { id: 'c2', slug: 'phnom-penh', name: 'Phnom Penh', country: 'Cambodia', latitude: 11.5, longitude: 104.9 },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('packageFiltersToQuery', () => {
  it('omits empty values and serialises booleans explicitly', () => {
    expect(
      packageFiltersToQuery({ city: 'siem-reap', kidFriendly: true, q: '', page: 2, sort: 'price_asc' }),
    ).toBe('?city=siem-reap&kidFriendly=true&page=2&sort=price_asc');
  });

  it('returns an empty string when nothing is filtered', () => {
    expect(packageFiltersToQuery({})).toBe('');
  });
});

describe('PackageCard', () => {
  it('shows price, duration, city and links to the detail page', () => {
    render(<PackageCard pkg={makePackage()} />);

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Angkor Essentials');
    expect(screen.getByText('$189')).toBeInTheDocument();
    expect(screen.getByText(/Siem Reap/)).toBeInTheDocument();
    expect(screen.getByText(translate('common.perPerson'))).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: translate('packages.viewDetails') }),
    ).toHaveAttribute('href', '/packages/angkor-essentials-3-day');
  });

  it('badges a private, non kid-friendly trip correctly', () => {
    render(<PackageCard pkg={makePackage({ kind: 'PRIVATE', kidFriendly: false })} />);

    expect(screen.getByText(translate('packages.kindPrivate'))).toBeInTheDocument();
    expect(screen.queryByText(translate('packages.kidFriendlyBadge'))).not.toBeInTheDocument();
  });

  it('renders per-group pricing when the package is priced per group', () => {
    render(<PackageCard pkg={makePackage({ pricingMode: 'PER_GROUP', basePriceCents: 128_000 })} />);

    expect(screen.getByText('$1,280')).toBeInTheDocument();
    expect(screen.getByText(translate('common.perGroup'))).toBeInTheDocument();
  });
});

describe('PackageBrowser', () => {
  beforeEach(() => {
    getPage.mockReset();
    get.mockReset();
    get.mockResolvedValue(cities);
  });

  it('renders skeletons while loading, then the grid', async () => {
    let resolvePage: (value: unknown) => void = () => {};
    getPage.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );

    renderWithQuery(<PackageBrowser />);

    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    resolvePage({ items: [makePackage()], meta: { page: 1, limit: 9, total: 1, totalPages: 1 } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Angkor Essentials');
    });
    expect(screen.getByText(translate('packages.resultCountOne'))).toBeInTheDocument();
  });

  it('sends the selected filters to the API', async () => {
    getPage.mockResolvedValue({
      items: [makePackage()],
      meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();

    renderWithQuery(<PackageBrowser />);
    // Wait for the city list before selecting, otherwise the option does not exist yet.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Phnom Penh' })).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText(translate('packages.filterCity')),
      'phnom-penh',
    );

    await waitFor(() => {
      const paths = getPage.mock.calls.map((call) => call[0] as string);
      expect(paths.some((path) => path.includes('city=phnom-penh'))).toBe(true);
    });
  });

  it('translates the duration band into day bounds', async () => {
    getPage.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });
    const user = userEvent.setup();

    renderWithQuery(<PackageBrowser />);
    await waitFor(() => expect(getPage).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(translate('packages.filterDuration')), 'medium');

    await waitFor(() => {
      const paths = getPage.mock.calls.map((call) => call[0] as string);
      expect(paths.some((path) => path.includes('minDays=4') && path.includes('maxDays=7'))).toBe(
        true,
      );
    });
  });

  it('shows an empty state instead of a blank grid', async () => {
    getPage.mockResolvedValue({ items: [], meta: { page: 1, limit: 9, total: 0, totalPages: 0 } });

    renderWithQuery(<PackageBrowser />);

    await waitFor(() => {
      expect(screen.getByText(translate('packages.empty'))).toBeInTheDocument();
    });
    expect(screen.getByText(translate('packages.emptyHint'))).toBeInTheDocument();
  });

  it('shows a recoverable error state when the catalogue call fails', async () => {
    getPage.mockRejectedValue(new Error('boom'));

    renderWithQuery(<PackageBrowser />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(translate('packages.loadError'));
    });
  });

  it('pages forward and resets to page 1 when a filter changes', async () => {
    getPage.mockResolvedValue({
      items: [makePackage()],
      meta: { page: 1, limit: 9, total: 20, totalPages: 3 },
    });
    const user = userEvent.setup();

    renderWithQuery(<PackageBrowser />);
    // The pager only renders once a multi-page result has arrived.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: translate('packages.nextPage') })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: translate('packages.nextPage') }));
    await waitFor(() => {
      const paths = getPage.mock.calls.map((call) => call[0] as string);
      expect(paths.some((path) => path.includes('page=2'))).toBe(true);
    });

    getPage.mockClear();
    await user.selectOptions(screen.getByLabelText(translate('packages.filterCity')), 'siem-reap');

    await waitFor(() => {
      const paths = getPage.mock.calls.map((call) => call[0] as string);
      expect(paths.some((path) => path.includes('page=1') && path.includes('city=siem-reap'))).toBe(
        true,
      );
    });
  });
});
