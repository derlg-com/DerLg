import { create } from 'zustand';

import { api, configureAuthBridge, refreshSession } from '@/lib/api-client';
import type { AuthSession, PublicUser } from '@/types/auth';

/**
 * Session state.
 *
 * `accessToken` is held in memory only — never localStorage — so a script
 * injection cannot exfiltrate it. Durability across reloads comes from the
 * httpOnly refresh cookie: `hydrate()` exchanges it for a fresh access token on
 * first mount.
 */
interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  /** True until the first refresh attempt settles, so guards can wait. */
  isHydrating: boolean;

  setSession: (session: AuthSession) => void;
  setAccessToken: (accessToken: string | null) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isHydrating: true,

  setSession: (session) => set({ user: session.user, accessToken: session.accessToken }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clear: () => set({ user: null, accessToken: null }),

  hydrate: async () => {
    const token = await refreshSession();

    if (!token) {
      set({ user: null, accessToken: null, isHydrating: false });
      return;
    }

    try {
      const user = await api.get<PublicUser>('/users/me');
      set({ user, accessToken: token, isHydrating: false });
    } catch {
      set({ user: null, accessToken: null, isHydrating: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', undefined, { retryOnUnauthorized: false });
    } finally {
      get().clear();
    }
  },
}));

// Give the api-client read/write access to the token without importing React.
configureAuthBridge(
  () => useAuthStore.getState().accessToken,
  (accessToken) => {
    useAuthStore.setState({ accessToken });
    if (accessToken === null) {
      useAuthStore.setState({ user: null });
    }
  },
);
