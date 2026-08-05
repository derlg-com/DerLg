import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { translate } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth.store';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const postMock = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: { ...actual.api, post: (path: string, body?: unknown) => postMock(path, body) },
  };
});

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const session = {
  user: {
    id: 'u1',
    email: 'a@b.com',
    fullName: 'Sok Dara',
    role: 'TRAVELER' as const,
    locale: 'en',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  accessToken: 'access-token',
  expiresIn: 900,
};

describe('RegisterForm', () => {
  beforeEach(() => {
    push.mockReset();
    postMock.mockReset();
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: false });
  });

  it('blocks submission and shows field errors for invalid input', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RegisterForm />);

    await user.type(screen.getByLabelText(translate('auth.fullNameLabel')), 'A');
    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'not-an-email');
    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'short');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignUp') }));

    await waitFor(() => {
      expect(screen.getByText(translate('validation.nameTooShort'))).toBeInTheDocument();
    });
    expect(screen.getByText(translate('validation.emailInvalid'))).toBeInTheDocument();
    expect(screen.getByText(translate('validation.passwordTooShort'))).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('requires upper, lower and a digit in the password', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RegisterForm />);

    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'alllowercase');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignUp') }));

    await waitFor(() => {
      expect(screen.getByText(translate('validation.passwordNeedsUpper'))).toBeInTheDocument();
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('submits valid input, stores the session and redirects', async () => {
    postMock.mockResolvedValue(session);
    const user = userEvent.setup();
    renderWithQuery(<RegisterForm redirectTo="/packages" />);

    await user.type(screen.getByLabelText(translate('auth.fullNameLabel')), 'Sok Dara');
    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'a@b.com');
    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'Sup3rSecret');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignUp') }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/auth/register', {
        fullName: 'Sok Dara',
        email: 'a@b.com',
        password: 'Sup3rSecret',
      });
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/packages'));
    expect(useAuthStore.getState().user?.fullName).toBe('Sok Dara');
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });

  it('reflects password strength as the user types', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RegisterForm />);

    expect(screen.getByTestId('strength-label')).toHaveTextContent(translate('auth.strength0'));

    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'Sup3rSecret!x');

    await waitFor(() => {
      expect(screen.getByTestId('strength-label')).toHaveTextContent(translate('auth.strength4'));
    });
  });

  it('shows the API error message when registration is rejected', async () => {
    const { ApiError } = await import('@/lib/api-client');
    postMock.mockRejectedValue(
      new ApiError(409, 'AUTH_EMAIL_TAKEN', 'An account with that email already exists.'),
    );
    const user = userEvent.setup();
    renderWithQuery(<RegisterForm />);

    await user.type(screen.getByLabelText(translate('auth.fullNameLabel')), 'Sok Dara');
    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'a@b.com');
    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'Sup3rSecret');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignUp') }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    });
    expect(push).not.toHaveBeenCalled();
  });
});

describe('LoginForm', () => {
  beforeEach(() => {
    push.mockReset();
    postMock.mockReset();
    useAuthStore.setState({ user: null, accessToken: null, isHydrating: false });
  });

  it('validates the email before calling the API', async () => {
    const user = userEvent.setup();
    renderWithQuery(<LoginForm />);

    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'nope');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignIn') }));

    await waitFor(() => {
      expect(screen.getByText(translate('validation.emailInvalid'))).toBeInTheDocument();
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('signs in and redirects to the requested path', async () => {
    postMock.mockResolvedValue(session);
    const user = userEvent.setup();
    renderWithQuery(<LoginForm redirectTo="/bookings" />);

    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'a@b.com');
    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'Sup3rSecret');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignIn') }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/auth/login', {
        email: 'a@b.com',
        password: 'Sup3rSecret',
      });
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/bookings'));
  });

  it('shows the generic credential error without leaking which field was wrong', async () => {
    const { ApiError } = await import('@/lib/api-client');
    postMock.mockRejectedValue(
      new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    const user = userEvent.setup();
    renderWithQuery(<LoginForm />);

    await user.type(screen.getByLabelText(translate('auth.emailLabel')), 'a@b.com');
    await user.type(screen.getByLabelText(translate('auth.passwordLabel')), 'wrong');
    await user.click(screen.getByRole('button', { name: translate('auth.submitSignIn') }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    });
  });
});
