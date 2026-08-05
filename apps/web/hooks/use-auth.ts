'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@/lib/api-client';
import type { LoginInput, RegisterInput } from '@/schemas/auth';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthSession } from '@/types/auth';

/**
 * Exchanges the httpOnly refresh cookie for a session on first mount. Mounted
 * once by the app shell so a page reload keeps the user signed in.
 */
export function useSessionHydration(): void {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}

export function useCurrentUser() {
  return {
    user: useAuthStore((state) => state.user),
    isHydrating: useAuthStore((state) => state.isHydrating),
    isAuthenticated: useAuthStore((state) => state.user !== null),
  };
}

export function useRegister(redirectTo = '/') {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<AuthSession>('/auth/register', input),
    onSuccess: (session) => {
      setSession(session);
      router.push(redirectTo);
    },
  });
}

export function useLogin(redirectTo = '/') {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthSession>('/auth/login', input),
    onSuccess: (session) => {
      setSession(session);
      router.push(redirectTo);
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => router.push('/'),
  });
}
