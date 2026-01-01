import { useState, useEffect, useCallback, useRef } from 'react';
import pb from '@/lib/pocketbase/client';
import { useThumbnailStore } from '@/stores';

interface ThumbnailState {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  isCached: boolean;
}

interface UseThumbnailOptions {
  /**
   * Whether to automatically fetch the thumbnail
   */
  autoFetch?: boolean;
  /**
   * Refresh interval in milliseconds (default: 5 minutes)
   * Set to 0 to disable auto-refresh
   */
  refreshInterval?: number;
  /**
   * Whether to fetch thumbnail only when element is visible
   */
  lazyLoad?: boolean;
  /**
   * Fallback image URL if thumbnail fails to load
   */
  fallbackUrl?: string;
  /**
   * Stream URL (if not fetching from database)
   */
  streamUrl?: string;
}

const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for fetching and managing live thumbnails for IPTV channels
 * Now uses centralized thumbnail store for caching across components
 */
export function useThumbnail(
  channelId: string,
  options: UseThumbnailOptions = {}
): ThumbnailState & {
  refresh: () => void;
  prefetch: () => void;
} {
  const {
    autoFetch = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    lazyLoad = false,
    fallbackUrl,
    streamUrl,
  } = options;

  // Use the centralized thumbnail store
  const {
    getThumbnail,
    isFetching,
    hasFailed,
    fetchThumbnail,
    clearThumbnail,
    needsRefresh,
  } = useThumbnailStore();

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const thumbnailUrl = getThumbnail(channelId);
  const isLoading = isFetching(channelId);
  const hasError = hasFailed(channelId);

  const state: ThumbnailState = {
    url: thumbnailUrl || (hasError ? fallbackUrl || null : null),
    isLoading,
    error: hasError ? 'Failed to load thumbnail' : null,
    isCached: !!thumbnailUrl,
  };

  const refresh = useCallback(() => {
    clearThumbnail(channelId);
    fetchThumbnail(channelId, streamUrl);
  }, [channelId, streamUrl, clearThumbnail, fetchThumbnail]);

  const prefetch = useCallback(() => {
    if (!thumbnailUrl && !isLoading) {
      fetchThumbnail(channelId, streamUrl);
    }
  }, [thumbnailUrl, isLoading, channelId, streamUrl, fetchThumbnail]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch && !lazyLoad && !thumbnailUrl && !isLoading && !hasError) {
      fetchThumbnail(channelId, streamUrl);
    }
  }, [channelId, autoFetch, lazyLoad, thumbnailUrl, isLoading, hasError, fetchThumbnail, streamUrl]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && autoFetch && !lazyLoad && thumbnailUrl) {
      refreshTimerRef.current = setInterval(() => {
        if (needsRefresh(channelId, refreshInterval)) {
          refresh();
        }
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshInterval, autoFetch, lazyLoad, thumbnailUrl, channelId, needsRefresh, refresh]);

  return {
    ...state,
    refresh,
    prefetch,
  };
}

/**
 * Hook for preloading thumbnails for a list of channels in parallel
 * Uses the centralized store for efficient batch loading
 */
export function useThumbnailPreload(
  channels: Array<{ id: string; url?: string }>,
  options: {
    concurrency?: number;
    enabled?: boolean;
  } = {}
) {
  const { concurrency = 6, enabled = true } = options;
  const { fetchThumbnailsBatch, thumbnails, fetchingChannels } = useThumbnailStore();
  const [isPreloading, setIsPreloading] = useState(false);

  // Calculate progress
  const total = channels.length;
  const loaded = channels.filter((ch) => thumbnails.has(ch.id)).length;
  const loading = channels.filter((ch) => fetchingChannels.has(ch.id)).length;

  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    const preload = async () => {
      setIsPreloading(true);
      await fetchThumbnailsBatch(channels, concurrency);
      setIsPreloading(false);
    };

    preload();
  }, [enabled, channels.length, concurrency, fetchThumbnailsBatch]);

  return {
    isPreloading: isPreloading || loading > 0,
    progress: {
      loaded,
      loading,
      total,
      percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
    },
  };
}

/**
 * Hook for managing thumbnails for multiple channels efficiently
 * @deprecated Use useThumbnailPreload instead for better performance
 */
export function useThumbnailBatch(
  channels: Array<{ id: string; url: string }>,
  options: {
    concurrency?: number;
    autoFetch?: boolean;
  } = {}
) {
  const { concurrency = 3, autoFetch = true } = options;
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const generateBatch = useCallback(async () => {
    if (channels.length === 0) return;

    setIsLoading(true);
    setProgress({ completed: 0, total: channels.length });

    try {
      const channelMap: Record<string, string> = {};
      channels.forEach((ch) => {
        channelMap[ch.id] = ch.url;
      });

      const response = await fetch(`${pb.baseUrl}/api/thumbnails/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          channels: channelMap,
          concurrency,
        }),
      });

      if (!response.ok) {
        throw new Error('Batch generation failed');
      }

      const results = await response.json();

      // Build thumbnail URLs for successful generations
      const newThumbnails: Record<string, string> = {};
      const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);

      for (const channelId of Object.keys(results)) {
        if (results[channelId].success) {
          newThumbnails[channelId] = `${pb.baseUrl}/api/thumbnail/${channelId}?t=${timestamp}`;
        }
      }

      setThumbnails(newThumbnails);
      setProgress({ completed: Object.keys(newThumbnails).length, total: channels.length });
    } catch (error) {
      console.error('Failed to generate batch thumbnails:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channels, concurrency]);

  useEffect(() => {
    if (autoFetch && channels.length > 0) {
      generateBatch();
    }
  }, [autoFetch, channels.length]);

  return {
    thumbnails,
    isLoading,
    progress,
    generateBatch,
  };
}

/**
 * Get the thumbnail URL for a channel without fetching
 */
export function getThumbnailUrl(channelId: string, streamUrl?: string): string {
  const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);
  let url = `${pb.baseUrl}/api/thumbnail/${channelId}?t=${timestamp}`;
  if (streamUrl) {
    url += `&url=${encodeURIComponent(streamUrl)}`;
  }
  return url;
}
