import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collections } from '@/lib/pocketbase/client';
import type { Profile } from '@/types';

interface ProfileStore {
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfiles: (userId: string) => Promise<void>;
  setActiveProfile: (profile: Profile) => void;
  createProfile: (data: Partial<Profile>) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  clearProfiles: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfile: null,
      isLoading: false,
      error: null,

      fetchProfiles: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
          let records = await collections.profiles.getFullList({
            filter: `user ~ "${userId}"`,
            sort: 'created',
          });

          // If no profiles exist, create a default one
          // Only create if we don't already have a persisted active profile
          // This prevents creating duplicates when auth state is temporarily invalid
          if (records.length === 0) {
            const { activeProfile } = get();
            // Only create if there's no persisted profile from a previous session
            // Note: user field can be string or array depending on PocketBase relation config
            const profileUserId = Array.isArray(activeProfile?.user)
              ? activeProfile.user[0]
              : activeProfile?.user;
            if (!activeProfile || profileUserId !== userId) {
              const defaultProfile = await collections.profiles.create({
                user: userId,
                name: 'Default',
                is_kids: false,
                avatar_color: '#E50914',
              });
              records = [defaultProfile];
            }
          }

          set({
            profiles: records as unknown as Profile[],
            isLoading: false,
          });

          // If no active profile, set the first one
          const { activeProfile } = get();
          if (!activeProfile && records.length > 0) {
            set({ activeProfile: records[0] as unknown as Profile });
          } else if (activeProfile && records.length > 0) {
            // Verify active profile still exists in fetched records
            const exists = records.some(r => r.id === activeProfile.id);
            if (!exists) {
              set({ activeProfile: records[0] as unknown as Profile });
            }
          }
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      setActiveProfile: (profile: Profile) => {
        set({ activeProfile: profile });
      },

      createProfile: async (data: Partial<Profile>) => {
        set({ isLoading: true, error: null });
        try {
          const record = await collections.profiles.create(data);
          const profile = record as unknown as Profile;
          set((state) => ({
            profiles: [...state.profiles, profile],
            isLoading: false,
          }));
          return profile;
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      updateProfile: async (id: string, data: Partial<Profile>) => {
        set({ isLoading: true, error: null });
        try {
          const record = await collections.profiles.update(id, data);
          const updatedProfile = record as unknown as Profile;
          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === id ? updatedProfile : p
            ),
            activeProfile:
              state.activeProfile?.id === id
                ? updatedProfile
                : state.activeProfile,
            isLoading: false,
          }));
          return updatedProfile;
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      deleteProfile: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await collections.profiles.delete(id);
          set((state) => {
            const newProfiles = state.profiles.filter((p) => p.id !== id);
            return {
              profiles: newProfiles,
              activeProfile:
                state.activeProfile?.id === id
                  ? newProfiles[0] || null
                  : state.activeProfile,
              isLoading: false,
            };
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      clearProfiles: () => {
        set({
          profiles: [],
          activeProfile: null,
          error: null,
        });
      },
    }),
    {
      name: 'profile-storage',
      partialize: (state) => ({
        activeProfile: state.activeProfile,
      }),
    }
  )
);
