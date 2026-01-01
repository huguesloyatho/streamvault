import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pb, authHelpers, totpHelpers } from '@/lib/pocketbase/client';
import type { User, AuthState } from '@/types';

interface AuthStore extends AuthState {
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
  }) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  setup2FA: () => Promise<{ secret: string; qrCode: string }>;
  disable2FA: (code: string, password: string) => Promise<void>;
  setRequires2FA: (requires: boolean, userId?: string) => void;
  clearPending2FA: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      requires2FA: false,
      pendingUserId: undefined,

      login: async (email: string, password: string) => {
        try {
          const authData = await authHelpers.login(email, password);
          const user = authData.record as unknown as User;

          // Check if 2FA is required
          if (user.totp_enabled) {
            set({
              requires2FA: true,
              pendingUserId: user.id,
              isAuthenticated: false,
            });
            // Clear the auth store since we're not fully authenticated
            pb.authStore.clear();
            return false;
          }

          set({
            user,
            token: authData.token,
            isAuthenticated: true,
            isLoading: false,
            requires2FA: false,
            pendingUserId: undefined,
          });
          return true;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        try {
          const user = await authHelpers.register(data);
          set({
            user: user as unknown as User,
            token: pb.authStore.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        authHelpers.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          requires2FA: false,
          pendingUserId: undefined,
        });
      },

      refreshAuth: async () => {
        set({ isLoading: true });
        try {
          const authData = await authHelpers.refreshAuth();
          if (authData) {
            set({
              user: authData.record as unknown as User,
              token: authData.token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      verify2FA: async (code: string) => {
        const { pendingUserId } = get();
        if (!pendingUserId) {
          throw new Error('No pending 2FA verification');
        }

        try {
          const result = await totpHelpers.validate(pendingUserId, code);
          set({
            user: result.record as unknown as User,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
            requires2FA: false,
            pendingUserId: undefined,
          });
        } catch (error) {
          throw error;
        }
      },

      setup2FA: async () => {
        const result = await totpHelpers.setup();
        return {
          secret: result.secret,
          qrCode: result.qrCode,
        };
      },

      disable2FA: async (code: string, password: string) => {
        await totpHelpers.disable(code, password);
        const { user } = get();
        if (user) {
          set({
            user: { ...user, totp_enabled: false },
          });
        }
      },

      setRequires2FA: (requires: boolean, userId?: string) => {
        set({
          requires2FA: requires,
          pendingUserId: userId,
        });
      },

      clearPending2FA: () => {
        set({
          requires2FA: false,
          pendingUserId: undefined,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth state on app load
if (typeof window !== 'undefined') {
  // Subscribe to PocketBase auth store changes
  pb.authStore.onChange((token, model) => {
    if (token && model) {
      useAuthStore.setState({
        user: model as unknown as User,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  });

  // Initial check
  if (pb.authStore.isValid) {
    useAuthStore.setState({
      user: pb.authStore.model as unknown as User,
      token: pb.authStore.token,
      isAuthenticated: true,
      isLoading: false,
    });
  } else {
    useAuthStore.setState({ isLoading: false });
  }
}
