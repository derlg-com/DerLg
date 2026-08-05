import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { translate } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth.store';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const user = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'Sok Dara',
  role: 'TRAVELER' as const,
  locale: 'en',
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('RequireAuth', () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.pushState({}, '', '/bookings');
  });

  it('shows a loading state while the session is hydrating and does not redirect yet', () => {
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: true });

    render(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(translate('common.loading'));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    // Redirecting during hydration would bounce a signed-in user on reload.
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders children once a session exists', () => {
    useAuthStore.setState({ user, accessToken: 'token', isHydrating: false });

    render(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to login with a same-site next parameter when unauthenticated', async () => {
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: false });

    render(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fbookings');
    });
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
