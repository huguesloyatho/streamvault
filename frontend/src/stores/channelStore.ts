import { create } from 'zustand';
import { collections } from '@/lib/pocketbase/client';
import type { Channel, Playlist, Category } from '@/types';

interface ChannelStore {
  channels: Channel[];
  playlists: Playlist[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string | null;

  // Actions
  fetchChannels: (userId: string) => Promise<void>;
  fetchPlaylists: (userId: string) => Promise<void>;
  fetchCategories: (userId: string) => Promise<void>;
  addPlaylist: (data: Partial<Playlist>) => Promise<Playlist>;
  updatePlaylist: (id: string, data: Partial<Playlist>) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addChannels: (channels: Partial<Channel>[]) => Promise<void>;
  updateChannel: (id: string, data: Partial<Channel>) => Promise<Channel>;
  deleteChannel: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  getChannelsByCategory: () => Record<string, Channel[]>;
  getFilteredChannels: () => Channel[];
  clearChannels: () => void;
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  playlists: [],
  categories: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: null,

  fetchChannels: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      // First get user's playlists
      const playlists = await collections.playlists.getFullList({
        filter: `user ~ "${userId}"`,
      });

      if (playlists.length === 0) {
        set({ channels: [], isLoading: false });
        return;
      }

      // Then get channels from those playlists
      const playlistIds = playlists.map((p) => p.id);
      const filter = playlistIds.map((id) => `playlist ~ "${id}"`).join(' || ');

      const records = await collections.channels.getFullList({
        filter: filter,
        sort: 'name',
      });

      // Deduplicate channels by URL to avoid showing the same stream multiple times
      const seenUrls = new Set<string>();
      const uniqueChannels = (records as unknown as Channel[]).filter((channel) => {
        if (seenUrls.has(channel.url)) {
          return false;
        }
        seenUrls.add(channel.url);
        return true;
      });

      console.log(`Fetched ${records.length} channels, ${uniqueChannels.length} unique`);

      set({
        channels: uniqueChannels,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching channels:', error);
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  fetchPlaylists: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const records = await collections.playlists.getFullList({
        filter: `user ~ "${userId}"`,
        sort: '-created',
      });
      set({
        playlists: records as unknown as Playlist[],
        isLoading: false,
      });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  fetchCategories: async (userId: string) => {
    try {
      const records = await collections.categories.getFullList({
        filter: `user ~ "${userId}" && is_visible = true`,
        sort: 'sort_order',
      });
      set({ categories: records as unknown as Category[] });
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  },

  addPlaylist: async (data: Partial<Playlist>) => {
    set({ isLoading: true, error: null });
    try {
      const record = await collections.playlists.create(data);
      const playlist = record as unknown as Playlist;
      set((state) => ({
        playlists: [...state.playlists, playlist],
        isLoading: false,
      }));
      return playlist;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      throw error;
    }
  },

  updatePlaylist: async (id: string, data: Partial<Playlist>) => {
    set({ isLoading: true, error: null });
    try {
      const record = await collections.playlists.update(id, data);
      const updated = record as unknown as Playlist;
      set((state) => ({
        playlists: state.playlists.map((p) => (p.id === id ? updated : p)),
        isLoading: false,
      }));
      return updated;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      throw error;
    }
  },

  deletePlaylist: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await collections.playlists.delete(id);
      set((state) => ({
        playlists: state.playlists.filter((p) => p.id !== id),
        channels: state.channels.filter((c) => c.playlist !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      throw error;
    }
  },

  addChannels: async (channels: Partial<Channel>[]) => {
    set({ isLoading: true, error: null });
    try {
      const created: Channel[] = [];
      for (const channel of channels) {
        // Check for duplicates based on URL and playlist
        const playlistId = channel.playlist;
        if (playlistId && channel.url) {
          try {
            const existing = await collections.channels.getFirstListItem(
              `playlist ~ "${playlistId}" && url = "${channel.url}"`
            );
            // Channel already exists, skip
            if (existing) {
              console.log(`Skipping duplicate channel: ${channel.name}`);
              continue;
            }
          } catch {
            // No duplicate found, proceed with creation
          }
        }
        const record = await collections.channels.create(channel);
        created.push(record as unknown as Channel);
      }
      set((state) => ({
        channels: [...state.channels, ...created],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      throw error;
    }
  },

  updateChannel: async (id: string, data: Partial<Channel>) => {
    try {
      const record = await collections.channels.update(id, data);
      const updated = record as unknown as Channel;
      set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? updated : c)),
      }));
      return updated;
    } catch (error) {
      throw error;
    }
  },

  deleteChannel: async (id: string) => {
    try {
      await collections.channels.delete(id);
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== id),
      }));
    } catch (error) {
      throw error;
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedCategory: (category: string | null) => {
    set({ selectedCategory: category });
  },

  getChannelsByCategory: () => {
    const { channels } = get();
    return channels.reduce((acc, channel) => {
      const category = channel.group_title || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(channel);
      return acc;
    }, {} as Record<string, Channel[]>);
  },

  getFilteredChannels: () => {
    const { channels, searchQuery, selectedCategory } = get();
    let filtered = channels;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.group_title.toLowerCase().includes(query) ||
          c.tvg_name?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((c) => c.group_title === selectedCategory);
    }

    return filtered;
  },

  clearChannels: () => {
    set({
      channels: [],
      playlists: [],
      categories: [],
      error: null,
      searchQuery: '',
      selectedCategory: null,
    });
  },
}));
