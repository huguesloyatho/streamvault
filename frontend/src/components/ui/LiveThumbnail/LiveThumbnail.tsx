'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Tv, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThumbnailStore } from '@/stores';

interface LiveThumbnailProps {
  channelId: string;
  channelName?: string;
  streamUrl?: string;
  fallbackLogo?: string;
  className?: string;
  /**
   * Whether to show the live indicator
   */
  showLiveIndicator?: boolean;
  /**
   * Refresh interval in milliseconds (default: 5 minutes)
   * Set to 0 to disable auto-refresh
   */
  refreshInterval?: number;
  /**
   * Whether to enable lazy loading (only load when visible)
   */
  lazyLoad?: boolean;
  /**
   * Whether to show loading skeleton
   */
  showSkeleton?: boolean;
  /**
   * Callback when thumbnail loads successfully
   */
  onLoad?: () => void;
  /**
   * Callback when thumbnail fails to load
   */
  onError?: (error: Error) => void;
  /**
   * Enable hover refresh button
   */
  enableRefresh?: boolean;
}

const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function LiveThumbnail({
  channelId,
  channelName,
  streamUrl,
  fallbackLogo,
  className,
  showLiveIndicator = true,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  lazyLoad = true,
  showSkeleton = true,
  onLoad,
  onError,
  enableRefresh = true,
}: LiveThumbnailProps) {
  const [isVisible, setIsVisible] = useState(!lazyLoad);
  const [isHovered, setIsHovered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use centralized thumbnail store
  const {
    getThumbnail,
    hasThumbnail,
    isFetching,
    hasFailed,
    fetchThumbnail,
    needsRefresh,
    clearThumbnail,
  } = useThumbnailStore();

  const thumbnailUrl = getThumbnail(channelId);
  const isLoading = isFetching(channelId);
  const hasError = hasFailed(channelId) || imageError;

  // Fetch thumbnail from store
  const loadThumbnail = useCallback(async (isRefresh = false) => {
    if (!channelId || !isVisible) return;

    if (isRefresh) {
      setIsRefreshing(true);
      // Clear existing thumbnail to force refresh
      clearThumbnail(channelId);
    }

    try {
      const result = await fetchThumbnail(channelId, streamUrl);
      if (result) {
        setImageError(false);
        onLoad?.();
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsRefreshing(false);
    }
  }, [channelId, streamUrl, isVisible, fetchThumbnail, clearThumbnail, onLoad, onError]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazyLoad) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before visible
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazyLoad]);

  // Fetch thumbnail when visible (if not already cached)
  useEffect(() => {
    if (isVisible && !hasThumbnail(channelId) && !isLoading && !hasFailed(channelId)) {
      loadThumbnail();
    }
  }, [isVisible, channelId, hasThumbnail, isLoading, hasFailed, loadThumbnail]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && isVisible && thumbnailUrl) {
      refreshTimerRef.current = setInterval(() => {
        // Only refresh if the thumbnail is stale
        if (needsRefresh(channelId, refreshInterval)) {
          loadThumbnail(true);
        }
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshInterval, isVisible, thumbnailUrl, channelId, needsRefresh, loadThumbnail]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    loadThumbnail(true);
  };

  const handleImageError = () => {
    setImageError(true);
    // Clear the cached thumbnail since it's invalid
    clearThumbnail(channelId);
  };

  // Render loading skeleton - show fallback while loading to prevent layout collapse
  if (isLoading && showSkeleton && !thumbnailUrl) {
    return (
      <div
        ref={containerRef}
        className={cn('relative overflow-hidden', className)}
      >
        {fallbackLogo ? (
          <Image
            src={fallbackLogo}
            alt={channelName || 'Channel logo'}
            fill
            className="object-cover opacity-50"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background-tertiary to-background-secondary flex items-center justify-center">
            <Tv className="w-12 h-12 text-text-muted" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <Wifi className="w-8 h-8 text-white animate-pulse" />
        </div>
      </div>
    );
  }

  // Render thumbnail or fallback
  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {thumbnailUrl && !hasError ? (
        <>
          <Image
            src={thumbnailUrl}
            alt={channelName || 'Channel thumbnail'}
            fill
            className="object-cover"
            onError={handleImageError}
            unoptimized // Required for blob URLs
          />

          {/* Live indicator */}
          {showLiveIndicator && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-xs font-medium text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          )}

          {/* Refresh button */}
          {enableRefresh && isHovered && (
            <button
              onClick={handleRefresh}
              className={cn(
                'absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/50 text-white',
                'hover:bg-black/70 transition-all',
                isRefreshing && 'animate-spin'
              )}
              disabled={isRefreshing}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Refreshing overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </>
      ) : fallbackLogo ? (
        <Image
          src={fallbackLogo}
          alt={channelName || 'Channel logo'}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background-tertiary to-background-secondary flex items-center justify-center">
          <Tv className="w-12 h-12 text-text-muted" />
        </div>
      )}
    </div>
  );
}
