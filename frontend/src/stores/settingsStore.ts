import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThumbnailSettings {
  /**
   * Enable live thumbnails for channel cards
   */
  enabled: boolean;
  /**
   * Refresh interval in minutes
   */
  refreshInterval: number;
  /**
   * Show live indicator on thumbnails
   */
  showLiveIndicator: boolean;
  /**
   * Enable lazy loading for thumbnails
   */
  lazyLoad: boolean;
  /**
   * Thumbnail quality (1-100)
   */
  quality: number;
}

interface DisplaySettings {
  /**
   * Default channel card variant
   */
  cardVariant: 'default' | 'compact' | 'featured';
  /**
   * Number of channels per row
   */
  gridColumns: number;
  /**
   * Show channel logos
   */
  showLogos: boolean;
  /**
   * Show channel groups
   */
  showGroups: boolean;
}

interface SettingsStore {
  thumbnail: ThumbnailSettings;
  display: DisplaySettings;

  // Thumbnail settings actions
  setThumbnailEnabled: (enabled: boolean) => void;
  setThumbnailRefreshInterval: (minutes: number) => void;
  setShowLiveIndicator: (show: boolean) => void;
  setThumbnailLazyLoad: (enabled: boolean) => void;
  setThumbnailQuality: (quality: number) => void;
  updateThumbnailSettings: (settings: Partial<ThumbnailSettings>) => void;

  // Display settings actions
  setCardVariant: (variant: 'default' | 'compact' | 'featured') => void;
  setGridColumns: (columns: number) => void;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;

  // Reset
  resetSettings: () => void;
}

const defaultThumbnailSettings: ThumbnailSettings = {
  enabled: false, // Off by default to save bandwidth
  refreshInterval: 5, // 5 minutes
  showLiveIndicator: true,
  lazyLoad: true,
  quality: 85,
};

const defaultDisplaySettings: DisplaySettings = {
  cardVariant: 'default',
  gridColumns: 4,
  showLogos: true,
  showGroups: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      thumbnail: { ...defaultThumbnailSettings },
      display: { ...defaultDisplaySettings },

      // Thumbnail settings actions
      setThumbnailEnabled: (enabled) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, enabled },
        })),

      setThumbnailRefreshInterval: (minutes) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, refreshInterval: minutes },
        })),

      setShowLiveIndicator: (show) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, showLiveIndicator: show },
        })),

      setThumbnailLazyLoad: (enabled) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, lazyLoad: enabled },
        })),

      setThumbnailQuality: (quality) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, quality: Math.min(100, Math.max(1, quality)) },
        })),

      updateThumbnailSettings: (settings) =>
        set((state) => ({
          thumbnail: { ...state.thumbnail, ...settings },
        })),

      // Display settings actions
      setCardVariant: (variant) =>
        set((state) => ({
          display: { ...state.display, cardVariant: variant },
        })),

      setGridColumns: (columns) =>
        set((state) => ({
          display: { ...state.display, gridColumns: Math.min(6, Math.max(2, columns)) },
        })),

      updateDisplaySettings: (settings) =>
        set((state) => ({
          display: { ...state.display, ...settings },
        })),

      // Reset
      resetSettings: () =>
        set({
          thumbnail: { ...defaultThumbnailSettings },
          display: { ...defaultDisplaySettings },
        }),
    }),
    {
      name: 'iptv-settings',
      version: 1,
    }
  )
);
