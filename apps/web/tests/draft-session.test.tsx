import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftSession } from '@/components/journey/DraftSession';
import { translate } from '@/lib/i18n';
import type { DraftView } from '@/types/journey';
import { useAuthStore } from '@/stores/auth.store';

// The editor is exercised by its own suite; here we only care about the
// handoff branches the session owns (banner, not-found, sign-in), so a stub
// keeps this test from coupling to JourneyEditor internals.
vi.mock('@/components/journey/JourneyEditor', () => ({
  JourneyEditor: () => <div data-testid="editor-stub" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: (path: string) => getMock(path) as Promise<unknown>,
    },
  };
});

const user = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'Sok Dara',
  role: 'TRAVELER' as const,
  locale: 'en',
  createdAt: '2026-08-01T00:00:00.000Z',
};

function makeDraft(overrides: Partial<DraftView> = {}): DraftView {
  return {
    id: 'draft-1',
    title: 'Angkor Essentials',
    source: 'MANUAL',
    packageId: 'pkg-1',
    packageSlug: 'angkor-essentials-3-day',
    startDate: '2027-07-01',
    guests: 2,
    days: [],
    price: {
      baseCents: 0,
      itemsCents: 0,
      templateItemsCents: 0,
      deltaCents: 0,
      totalCents: 0,
      currency: 'USD',
      lines: [],
    },
    availability: { available: true, unavailableCount: 0, items: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderSession(draftId = 'draft-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftSession draftId={draftId} />
    </QueryClientProvider>,
  );
}

describe('DraftSession — the AI ⇄ editor handoff', () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: false });
  });

  it('shows the concierge banner on an AI-composed draft', async () => {
    useAuthStore.setState({ user, accessToken: 'token', isHydrating: false });
    getMock.mockResolvedValue(makeDraft({ source: 'AI' }));

    renderSession('draft-9');

    expect(getMock).toHaveBeenCalledWith('/journey-drafts/draft-9');

    expect(await screen.findByText(translate('customize.fromConcierge'))).toBeInTheDocument();
    const backLink = screen.getByRole('link', { name: translate('customize.backToConcierge') });
    expect(backLink).toHaveAttribute('href', '/vibe');
    expect(await screen.findByTestId('editor-stub')).toBeInTheDocument();
  });

  it('does not show the concierge banner on a manually-built draft', async () => {
    useAuthStore.setState({ user, accessToken: 'token', isHydrating: false });
    getMock.mockResolvedValue(makeDraft({ source: 'MANUAL' }));

    renderSession();

    expect(await screen.findByTestId('editor-stub')).toBeInTheDocument();
    expect(screen.queryByText(translate('customize.fromConcierge'))).not.toBeInTheDocument();
  });

  it('shows a not-found message with a browse link when the draft belongs to someone else', async () => {
    useAuthStore.setState({ user, accessToken: 'token', isHydrating: false });
    getMock.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));

    renderSession('draft-other');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(translate('customize.draftNotFound'));
    const browseLink = screen.getByRole('link', { name: translate('customize.browseTrips') });
    expect(browseLink).toHaveAttribute('href', '/packages');
    expect(screen.queryByTestId('editor-stub')).not.toBeInTheDocument();
  });

  it('renders a sign-in link carrying the journey path when unauthenticated', () => {
    // Auth store already cleared in beforeEach.
    renderSession('draft-9');

    expect(screen.queryByTestId('editor-stub')).not.toBeInTheDocument();
    const signInLink = screen.getByRole('link', { name: translate('customize.signInPrompt') });
    expect(signInLink).toHaveAttribute('href', '/login?next=%2Fjourneys%2Fdraft-9');
    // It must not attempt to read the draft of a user it cannot identify.
    expect(getMock).not.toHaveBeenCalled();
  });

  it('waits while the session is still hydrating, before deciding what to fetch', () => {
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: true });

    renderSession('draft-9');

    expect(screen.getByRole('status')).toHaveTextContent(translate('customize.loading'));
    expect(getMock).not.toHaveBeenCalled();
  });
});