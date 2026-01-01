import PocketBase from 'pocketbase';
import type { User } from '@/types';

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

// Create PocketBase instance
export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto cancellation for better control
pb.autoCancellation(false);

// Auth helpers
export const authHelpers = {
  // Get current user
  getCurrentUser: (): User | null => {
    if (!pb.authStore.isValid) return null;
    return pb.authStore.record as unknown as User;
  },

  // Check if authenticated
  isAuthenticated: (): boolean => {
    return pb.authStore.isValid;
  },

  // Get auth token
  getToken: (): string | null => {
    return pb.authStore.token;
  },

  // Login with email/password
  login: async (email: string, password: string) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData;
  },

  // Register new user
  register: async (data: {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
  }) => {
    const user = await pb.collection('users').create({
      ...data,
      emailVisibility: true,
    });
    // Auto-login after registration
    await pb.collection('users').authWithPassword(data.email, data.password);
    return user;
  },

  // Logout
  logout: () => {
    pb.authStore.clear();
  },

  // Refresh auth
  refreshAuth: async () => {
    if (!pb.authStore.isValid) return null;
    try {
      const authData = await pb.collection('users').authRefresh();
      return authData;
    } catch {
      pb.authStore.clear();
      return null;
    }
  },

  // Request password reset
  requestPasswordReset: async (email: string) => {
    await pb.collection('users').requestPasswordReset(email);
  },

  // Update user
  updateUser: async (id: string, data: Partial<User>) => {
    return await pb.collection('users').update(id, data);
  },
};

// TOTP helpers
export const totpHelpers = {
  // Setup TOTP (get QR code)
  setup: async () => {
    const response = await fetch(`${POCKETBASE_URL}/api/auth/totp/setup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pb.authStore.token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to setup TOTP');
    }
    return response.json();
  },

  // Verify TOTP code (after setup or during login)
  verify: async (code: string) => {
    const response = await fetch(`${POCKETBASE_URL}/api/auth/totp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pb.authStore.token}`,
      },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid TOTP code');
    }
    return response.json();
  },

  // Validate TOTP during login (when not fully authenticated)
  validate: async (userId: string, code: string) => {
    const response = await fetch(`${POCKETBASE_URL}/api/auth/totp/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, code }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid TOTP code');
    }
    const data = await response.json();
    // Save the auth token
    pb.authStore.save(data.token, data.record);
    return data;
  },

  // Disable TOTP
  disable: async (code: string, password: string) => {
    const response = await fetch(`${POCKETBASE_URL}/api/auth/totp/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pb.authStore.token}`,
      },
      body: JSON.stringify({ code, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disable TOTP');
    }
    return response.json();
  },

  // Get TOTP status
  getStatus: async () => {
    const response = await fetch(`${POCKETBASE_URL}/api/auth/totp/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${pb.authStore.token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to get TOTP status');
    }
    return response.json();
  },
};

// Collection helpers
export const collections = {
  profiles: pb.collection('profiles'),
  playlists: pb.collection('playlists'),
  channels: pb.collection('channels'),
  categories: pb.collection('categories'),
  favorites: pb.collection('favorites'),
  watchHistory: pb.collection('watch_history'),
  epgSources: pb.collection('epg_sources'),
  epgPrograms: pb.collection('epg_programs'),
  recordings: pb.collection('recordings'),
  settings: pb.collection('settings'),
};

export default pb;
