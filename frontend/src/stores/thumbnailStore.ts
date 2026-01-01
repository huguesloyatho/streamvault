import { create } from 'zustand';
import pb from '@/lib/pocketbase/client';

interface ThumbnailEntry {
  blobUrl: string;
  timestamp: number;
  channelId: string;
}

interface ThumbnailStore {
  // Cache of thumbnails by channel ID
  thumbnails: Map<string, ThumbnailEntry>;

  // Track which channels are currently being fetched
  fetchingChannels: Set<string>;

  // Track failed channels to avoid retrying immediately
  failedChannels: Map<string, number>; // channelId -> failureTimestamp

  // Actions
  getThumbnail: (channelId: string) => string | null;
  hasThumbnail: (channelId: string) => boolean;
  isFetching: (channelId: string) => boolean;
  hasFailed: (channelId: string) => boolean;

  // Fetch single thumbnail
  fetchThumbnail: (channelId: string, streamUrl?: string) => Promise<string | null>;

  // Batch fetch thumbnails in parallel
  fetchThumbnailsBatch: (channels: Array<{ id: string; url?: string }>, concurrency?: number) => Promise<void>;

  // Mark channel as failed
  markFailed: (channelId: string) => void;

  // Clear failed status for retry
  clearFailed: (channelId: string) => void;

  // Clear all cached thumbnails
  clearAll: () => void;

  // Clear specific thumbnail
  clearThumbnail: (channelId: string) => void;

  // Check if thumbnail needs refresh based on age
  needsRefresh: (channelId: string, maxAgeMs?: number) => boolean;
}

const FAILURE_COOLDOWN = 60 * 1000; // 1 minute before retrying failed channels
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes default cache duration
const DEFAULT_CONCURRENCY = 6; // Number of parallel fetches

export const useThumbnailStore = create<ThumbnailStore>((set, get) => ({
  thumbnails: new Map(),
  fetchingChannels: new Set(),
  failedChannels: new Map(),

  getThumbnail: (channelId: string) => {
    const entry = get().thumbnails.get(channelId);
    return entry?.blobUrl || null;
  },

  hasThumbnail: (channelId: string) => {
    return get().thumbnails.has(channelId);
  },

  isFetching: (channelId: string) => {
    return get().fetchingChannels.has(channelId);
  },

  hasFailed: (channelId: string) => {
    const failedAt = get().failedChannels.get(channelId);
    if (!failedAt) return false;

    // Check if cooldown has passed
    if (Date.now() - failedAt > FAILURE_COOLDOWN) {
      // Clear the failed status after cooldown
      get().clearFailed(channelId);
      return false;
    }
    return true;
  },

  fetchThumbnail: async (channelId: string, streamUrl?: string) => {
    const state = get();

    // Return cached thumbnail if available and fresh
    const existing = state.thumbnails.get(channelId);
    if (existing && !state.needsRefresh(channelId)) {
      return existing.blobUrl;
    }

    // Skip if already fetching
    if (state.fetchingChannels.has(channelId)) {
      return null;
    }

    // Skip if recently failed
    if (state.hasFailed(channelId)) {
      return null;
    }

    // Mark as fetching
    set((s) => {
      const newFetching = new Set(s.fetchingChannels);
      newFetching.add(channelId);
      return { fetchingChannels: newFetching };
    });

    try {
      // Generate URL with timestamp for cache busting
      const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);
      let url = `${pb.baseUrl}/api/thumbnail/${channelId}?t=${timestamp}`;
      if (streamUrl) {
        url += `&url=${encodeURIComponent(streamUrl)}`;
      }

      const response = await fetch(url, {
        headers: pb.authStore.token
          ? { Authorization: `Bearer ${pb.authStore.token}` }
          : {},
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Store in cache
      set((s) => {
        // Clean up old blob URL if exists
        const oldEntry = s.thumbnails.get(channelId);
        if (oldEntry?.blobUrl) {
          URL.revokeObjectURL(oldEntry.blobUrl);
        }

        const newThumbnails = new Map(s.thumbnails);
        newThumbnails.set(channelId, {
          blobUrl,
          timestamp: Date.now(),
          channelId,
        });

        const newFetching = new Set(s.fetchingChannels);
        newFetching.delete(channelId);

        // Clear any failed status on success
        const newFailed = new Map(s.failedChannels);
        newFailed.delete(channelId);

        return {
          thumbnails: newThumbnails,
          fetchingChannels: newFetching,
          failedChannels: newFailed,
        };
      });

      return blobUrl;
    } catch (error) {
      // Mark as failed and remove from fetching
      set((s) => {
        const newFetching = new Set(s.fetchingChannels);
        newFetching.delete(channelId);

        const newFailed = new Map(s.failedChannels);
        newFailed.set(channelId, Date.now());

        return {
          fetchingChannels: newFetching,
          failedChannels: newFailed,
        };
      });
      return null;
    }
  },

  fetchThumbnailsBatch: async (
    channels: Array<{ id: string; url?: string }>,
    concurrency = DEFAULT_CONCURRENCY
  ) => {
    const state = get();

    // Filter out channels that already have thumbnails, are fetching, or have failed
    const toFetch = channels.filter(
      (ch) =>
        !state.thumbnails.has(ch.id) &&
        !state.fetchingChannels.has(ch.id) &&
        !state.hasFailed(ch.id)
    );

    if (toFetch.length === 0) return;

    // Process in batches with concurrency limit
    const processBatch = async (batch: Array<{ id: string; url?: string }>) => {
      await Promise.all(
        batch.map((ch) => get().fetchThumbnail(ch.id, ch.url))
      );
    };

    // Split into chunks based on concurrency
    for (let i = 0; i < toFetch.length; i += concurrency) {
      const batch = toFetch.slice(i, i + concurrency);
      await processBatch(batch);
    }
  },

  markFailed: (channelId: string) => {
    set((s) => {
      const newFailed = new Map(s.failedChannels);
      newFailed.set(channelId, Date.now());
      return { failedChannels: newFailed };
    });
  },

  clearFailed: (channelId: string) => {
    set((s) => {
      const newFailed = new Map(s.failedChannels);
      newFailed.delete(channelId);
      return { failedChannels: newFailed };
    });
  },

  clearAll: () => {
    const state = get();
    // Revoke all blob URLs
    state.thumbnails.forEach((entry) => {
      if (entry.blobUrl) {
        URL.revokeObjectURL(entry.blobUrl);
      }
    });
    set({
      thumbnails: new Map(),
      fetchingChannels: new Set(),
      failedChannels: new Map(),
    });
  },

  clearThumbnail: (channelId: string) => {
    set((s) => {
      const entry = s.thumbnails.get(channelId);
      if (entry?.blobUrl) {
        URL.revokeObjectURL(entry.blobUrl);
      }
      const newThumbnails = new Map(s.thumbnails);
      newThumbnails.delete(channelId);
      return { thumbnails: newThumbnails };
    });
  },

  needsRefresh: (channelId: string, maxAgeMs = DEFAULT_MAX_AGE) => {
    const entry = get().thumbnails.get(channelId);
    if (!entry) return true;
    return Date.now() - entry.timestamp > maxAgeMs;
  },
}));
